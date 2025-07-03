import { NextRequest, NextResponse } from "next/server";
import { findEmailVerification, markEmailVerificationAsUsed } from "@/models/email-verification";
import { createEmailUser, findEmailUser, findUserByInviteCode } from "@/models/user";
import { getUuid } from "@/lib/hash";
import { getIsoTimestr } from "@/lib/time";
import { getClientIp } from "@/lib/ip";
import { User } from "@/types/user";
import { CreditsAmount, CreditsTransType, increaseCredits } from "@/services/credit";
import { AffiliateRewardAmount, AffiliateRewardPercent, AffiliateStatus } from "@/services/constant";
import { insertAffiliate } from "@/models/affiliate";
import { updateUserInvitedBy } from "@/models/user";
import { getOneYearLaterTimestr } from "@/lib/time";
import { emailService } from "@/services/email";
import { DEFAULT_AVATAR_URL, PASSWORD_CONFIG } from "@/lib/constants";
import { log } from "@/lib/logger";
import { isValidEmail } from "@/lib/email-validator";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();

    // 调试日志：记录原始请求数据
    log.info("邮箱注册API - 原始请求数据", {
      requestData,
      endpoint: "/api/email-register"
    });

    // 直接从请求数据中提取参数
    const email = requestData.email;
    const password = requestData.password;
    const nickname = requestData.nickname;
    const verificationCode = requestData.verificationCode;
    const inviteCode = requestData.inviteCode;

    // 调试日志：记录解析后的参数
    log.info("邮箱注册API - 解析后的参数", {
      email,
      nickname,
      password: password ? `${password.length}位密码` : '无密码',
      verificationCode: verificationCode || '无验证码',
      inviteCode: inviteCode || '(空)',
      endpoint: "/api/email-register"
    });

    // 验证参数（邀请码是可选的）
    if (!email || !password || !nickname || !verificationCode) {
      log.warn("邮箱注册API - 缺少必要参数详情", {
        email: `"${email}"`,
        password: `"${password}"`,
        nickname: `"${nickname}"`,
        verificationCode: `"${verificationCode}"`,
        emailCheck: !email,
        passwordCheck: !password,
        nicknameCheck: !nickname,
        verificationCodeCheck: !verificationCode,
        endpoint: "/api/email-register"
      });
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "邮箱格式不正确" },
        { status: 400 }
      );
    }

    // 验证密码强度
    if (password.length < PASSWORD_CONFIG.MIN_LENGTH) {
      return NextResponse.json(
        { error: `密码长度至少${PASSWORD_CONFIG.MIN_LENGTH}位` },
        { status: 400 }
      );
    }

    // 验证昵称
    if (nickname.length < 1 || nickname.length > 50) {
      return NextResponse.json(
        { error: "昵称长度应在1-50字符之间" },
        { status: 400 }
      );
    }

    // 检查邮箱是否已注册
    const existingUser = await findEmailUser(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "该邮箱已注册" },
        { status: 400 }
      );
    }

    // 验证验证码
    const verification = await findEmailVerification(email, verificationCode, 'register');
    if (!verification) {
      return NextResponse.json(
        { error: "验证码无效或已过期" },
        { status: 400 }
      );
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, PASSWORD_CONFIG.SALT_ROUNDS);

    // 获取客户端IP
    const clientIp = await getClientIp();

    // 创建用户
    const userUuid = getUuid();
    const newUser: User & { password_hash: string } = {
      uuid: userUuid,
      email,
      nickname,
      avatar_url: DEFAULT_AVATAR_URL,
      password_hash: passwordHash,
      signin_type: 'email',
      signin_provider: 'email',
      signin_ip: clientIp,
      created_at: getIsoTimestr(),
      email_verified: true,
      email_verified_at: getIsoTimestr(),
      invited_by: '', // 初始为空，后续在邀请处理中设置
    };

    try {
      // 创建用户
      await createEmailUser(newUser);

      // 标记验证码为已使用
      await markEmailVerificationAsUsed(verification.id!);

      // 为新用户增加积分
      await increaseCredits({
        user_uuid: userUuid,
        trans_type: CreditsTransType.NewUser,
        credits: CreditsAmount.NewUserGet,
        expired_at: getOneYearLaterTimestr(),
      });

      // 如果有邀请码，检查并处理邀请关系
      if (inviteCode && inviteCode.trim()) {
        try {
          const inviteUser = await findUserByInviteCode(inviteCode.trim());
          if (inviteUser && inviteUser.uuid) {
            // 检查不能邀请自己
            if (inviteUser.email !== email) {
              // 1. 更新被邀请者的invited_by字段
              await updateUserInvitedBy(userUuid, inviteUser.uuid);

              // 2. 给被邀请者发放额外奖励
              await increaseCredits({
                user_uuid: userUuid,
                trans_type: CreditsTransType.InviteeBonus,
                credits: CreditsAmount.InviteeBonus,
                expired_at: getOneYearLaterTimestr(),
                order_no: `INVITEE_BONUS_${userUuid}_${Date.now()}`
              });

              // 3. 给邀请者发放奖励
              await increaseCredits({
                user_uuid: inviteUser.uuid,
                trans_type: CreditsTransType.SystemAdd,
                credits: AffiliateRewardAmount.Invited,
                expired_at: getOneYearLaterTimestr(),
                order_no: `INVITE_REWARD_${userUuid}_${Date.now()}`
              });

              // 4. 创建邀请关系记录
              await insertAffiliate({
                user_uuid: userUuid,
                invited_by: inviteUser.uuid,
                created_at: getIsoTimestr(),
                status: AffiliateStatus.Completed,
                paid_order_no: "",
                paid_amount: 0,
                reward_percent: AffiliateRewardPercent.Invited,
                reward_amount: AffiliateRewardAmount.Invited,
              });

              log.info("邀请关系建立成功", {
                invitee_uuid: userUuid,
                inviter_uuid: inviteUser.uuid,
                invite_code: inviteCode,
                invitee_bonus: CreditsAmount.InviteeBonus,
                inviter_reward: AffiliateRewardAmount.Invited
              });
            } else {
              log.warn("不能邀请自己，跳过邀请处理", {
                invitee_uuid: userUuid,
                invite_code: inviteCode
              });
            }
          } else {
            log.warn("邀请码无效，跳过邀请处理", {
              invitee_uuid: userUuid,
              invite_code: inviteCode
            });
          }
        } catch (error) {
          log.error("处理邀请关系失败", error as Error, {
            invitee_uuid: userUuid,
            invite_code: inviteCode
          });
        }
      }

      // 发送欢迎邮件（非阻塞）
      emailService.sendWelcomeEmail(email, nickname)
        .then((success) => {
          if (success) {
            log.info("欢迎邮件发送成功", { email, nickname });
          } else {
            log.warn("欢迎邮件发送失败", { email, nickname });
          }
        })
        .catch((error) => {
          log.error("欢迎邮件发送异常", error as Error, { email, nickname });
        });

      return NextResponse.json({
        message: "注册成功",
        user: {
          uuid: userUuid,
          email,
          nickname,
          avatar_url: newUser.avatar_url,
        },
      });

    } catch (error) {
      log.error("创建用户失败", error as Error, { email, nickname });
      return NextResponse.json(
        { error: "注册失败，请稍后再试" },
        { status: 500 }
      );
    }

  } catch (error) {
    log.error("邮箱注册失败", error as Error);
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    );
  }
}
