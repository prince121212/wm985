import { NextRequest } from "next/server";
import { respData, respErr, respUnauthorized, respInvalidParams } from "@/lib/resp";
import { getUserUuid, isUserAdmin } from "@/services/user";
import { createCategory, findCategoryByName, findCategoryByNameWithMinId } from "@/models/category";
import { log } from "@/lib/logger";
import { CategoryInput, ImportResult } from "@/types/admin";

// POST /api/admin/categories/batch-import - 批量导入分类
export async function POST(req: NextRequest) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    // 检查管理员权限
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return respUnauthorized("无管理员权限");
    }

    const body = await req.json().catch(() => ({}));
    const { categories } = body;

    if (!categories || !Array.isArray(categories)) {
      return respInvalidParams("categories参数必须是数组");
    }

    if (categories.length === 0) {
      return respInvalidParams("分类数组不能为空");
    }

    if (categories.length > 50) {
      return respInvalidParams("一次最多只能导入50个分类");
    }

    log.info("开始批量导入分类", { 
      count: categories.length, 
      user_uuid 
    });

    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      details: []
    };

    // 逐个处理分类
    for (let i = 0; i < categories.length; i++) {
      const categoryData = categories[i];
      
      try {
        // 验证单个分类数据
        const validationError = validateCategoryData(categoryData, i + 1);
        if (validationError) {
          result.failed++;
          result.errors.push(validationError);
          result.details.push({
            name: categoryData.name || `第${i + 1}项`,
            status: 'error',
            message: validationError
          });
          continue;
        }

        // 检查分类名称是否已存在
        const existingCategory = await findCategoryByName(categoryData.name.trim());
        if (existingCategory) {
          result.failed++;
          result.errors.push(`${categoryData.name}: 分类名称已存在，已跳过`);
          result.details.push({
            name: categoryData.name,
            status: 'error',
            message: '分类名称已存在，已跳过'
          });

          log.info("分类已存在，跳过创建", {
            categoryName: categoryData.name,
            existingId: existingCategory.id,
            batch_import: true
          });
          continue;
        }

        // 处理父分类ID
        let parentId: number | undefined = categoryData.parent_id;

        // 如果提供了父分类名称，通过名称查找父分类ID
        if (categoryData.parent_name && !parentId) {
          try {
            const parentCategory = await findCategoryByNameWithMinId(categoryData.parent_name.trim());
            if (parentCategory) {
              parentId = parentCategory.id;
              log.info("通过父分类名称找到父分类", {
                parentName: categoryData.parent_name,
                parentId: parentId,
                categoryName: categoryData.name
              });
            } else {
              result.failed++;
              const errorMessage = `父分类"${categoryData.parent_name}"不存在`;
              result.errors.push(`${categoryData.name}: ${errorMessage}`);
              result.details.push({
                name: categoryData.name,
                status: 'error',
                message: errorMessage
              });
              continue;
            }
          } catch (error) {
            result.failed++;
            const errorMessage = `查找父分类"${categoryData.parent_name}"失败`;
            result.errors.push(`${categoryData.name}: ${errorMessage}`);
            result.details.push({
              name: categoryData.name,
              status: 'error',
              message: errorMessage
            });
            log.error("查找父分类失败", error as Error, {
              parentName: categoryData.parent_name,
              categoryName: categoryData.name
            });
            continue;
          }
        }

        // 准备分类数据
        const category = {
          name: categoryData.name.trim(),
          description: categoryData.description?.trim() || undefined,
          icon: categoryData.icon?.trim() || undefined,
          sort_order: categoryData.sort_order || 0,
          parent_id: parentId
        };

        // 创建分类
        const createdCategory = await createCategory(category);
        
        result.success++;
        result.details.push({
          name: category.name,
          status: 'success',
          message: '创建成功'
        });

        log.info("分类创建成功", { 
          categoryId: createdCategory.id, 
          name: category.name,
          batch_import: true
        });

      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : '创建失败';
        
        // 处理特定错误类型
        let friendlyMessage = errorMessage;
        if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
          friendlyMessage = '分类名称已存在';
        } else if (errorMessage.includes('parent_id')) {
          friendlyMessage = '无效的父分类ID';
        }

        result.errors.push(`${categoryData.name || `第${i + 1}项`}: ${friendlyMessage}`);
        result.details.push({
          name: categoryData.name || `第${i + 1}项`,
          status: 'error',
          message: friendlyMessage
        });

        log.error("分类创建失败", error as Error, {
          categoryName: categoryData.name,
          batch_import: true,
          user_uuid
        });
      }
    }

    log.info("批量导入分类完成", {
      total: categories.length,
      success: result.success,
      failed: result.failed,
      user_uuid
    });

    return respData(result);

  } catch (error) {
    log.error("批量导入分类失败", error as Error, {
      user_uuid: await getUserUuid().catch(() => 'unknown'),
      endpoint: "/api/admin/categories/batch-import"
    });

    return respErr("批量导入失败，请稍后再试");
  }
}

// 验证单个分类数据
function validateCategoryData(data: any, index: number): string | null {
  if (!data || typeof data !== 'object') {
    return `第${index}项：数据格式错误`;
  }

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return `第${index}项：分类名称不能为空`;
  }

  if (data.name.trim().length > 50) {
    return `第${index}项：分类名称不能超过50个字符`;
  }

  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      return `第${index}项：描述必须是字符串类型`;
    }
    if (data.description.length > 200) {
      return `第${index}项：描述不能超过200个字符`;
    }
  }

  if (data.icon !== undefined && typeof data.icon !== 'string') {
    return `第${index}项：图标必须是字符串类型`;
  }

  if (data.sort_order !== undefined && typeof data.sort_order !== 'number') {
    return `第${index}项：排序必须是数字类型`;
  }

  if (data.parent_id !== undefined && typeof data.parent_id !== 'number') {
    return `第${index}项：父分类ID必须是数字类型`;
  }

  if (data.parent_name !== undefined && typeof data.parent_name !== 'string') {
    return `第${index}项：父分类名称必须是字符串类型`;
  }

  // parent_id 和 parent_name 不能同时存在
  if (data.parent_id !== undefined && data.parent_name !== undefined) {
    return `第${index}项：不能同时指定父分类ID和父分类名称`;
  }

  return null;
}
