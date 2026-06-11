import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { updateUserProfile } from "@/models/user";
import { newStorage } from "@/lib/storage";
import { getUuid } from "@/lib/hash";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

function getFileExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return mimeToExt[mimeType] || 'jpg';
}

export async function POST(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) return respUnauthorized("用户未登录");

    if (!process.env.STORAGE_ENDPOINT || !process.env.STORAGE_ACCESS_KEY || !process.env.STORAGE_SECRET_KEY || !process.env.STORAGE_BUCKET) {
      return respErr("存储服务配置不完整，请联系管理员");
    }

    const formData = await req.formData();
    const file = formData.get('avatar') as File | null;
    if (!file) return respInvalidParams("请选择要上传的头像");

    const fileType = file.type || 'image/jpeg';
    if (!ALLOWED_TYPES.includes(fileType)) {
      return respInvalidParams("请选择图片文件（JPG、PNG、GIF、WEBP）");
    }
    if (file.size > MAX_FILE_SIZE) {
      return respInvalidParams("文件大小不能超过2MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExtension = getFileExtensionFromMimeType(fileType);
    const filename = `mp_avatar_${user.uuid}_${getUuid()}.${fileExtension}`;
    const key = `avatars/${filename}`;

    const storage = newStorage();
    const uploadResult = await storage.uploadFile({
      body: buffer,
      key,
      contentType: fileType,
      disposition: "inline",
      optimize: true,
      quality: 85,
      maxWidth: 512,
      maxHeight: 512,
      format: 'webp',
    });

    await updateUserProfile(user.uuid, { avatar_url: uploadResult.publicUrl });

    return respData({
      url: uploadResult.publicUrl,
      user: {
        uuid: user.uuid,
        nickname: user.nickname,
        avatar_url: uploadResult.publicUrl,
        invite_code: user.invite_code,
      },
      message: "头像上传成功",
    });
  } catch (error) {
    log.error("上传小程序头像失败", error as Error);
    return respErr("头像上传失败");
  }
}
