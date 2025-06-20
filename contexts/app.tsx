"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { cacheGet, cacheRemove, cacheSet } from "@/lib/cache";

import { CacheKey } from "@/services/constant";
import { ContextValue } from "@/types/context";
import { User } from "@/types/user";
import moment from "moment";
import useOneTapLogin from "@/hooks/useOneTapLogin";
import { useSession } from "next-auth/react";
import { log } from "@/lib/logger";

const AppContext = createContext({} as ContextValue);

export const useAppContext = () => useContext(AppContext);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  if (
    process.env.NEXT_PUBLIC_AUTH_GOOGLE_ONE_TAP_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID
  ) {
    useOneTapLogin();
  }

  const { data: session } = useSession();

  const [theme, setTheme] = useState<string>(() => {
    return process.env.NEXT_PUBLIC_DEFAULT_THEME || "";
  });

  const [showSignModal, setShowSignModal] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    // 初始化时从缓存中读取管理员状态
    const cachedAdminStatus = cacheGet(CacheKey.AdminStatus);
    return cachedAdminStatus === 'true';
  });

  const [showFeedback, setShowFeedback] = useState<boolean>(false);

  // 用于防止重复请求的 ref
  const fetchingUserInfo = useRef<boolean>(false);
  const lastSessionId = useRef<string | null>(null);



  const updateInvite = useCallback(async (user: User) => {
    try {
      if (user.invited_by) {
        // user already been invited
        return;
      }

      const inviteCode = cacheGet(CacheKey.InviteCode);
      if (!inviteCode) {
        // no invite code
        return;
      }

      const userCreatedAt = moment(user.created_at).unix();
      const currentTime = moment().unix();
      const timeDiff = Number(currentTime - userCreatedAt);

      if (timeDiff <= 0 || timeDiff > 7200) {
        // user created more than 2 hours
        return;
      }

      // update invite relation
      const req = {
        invite_code: inviteCode,
        user_uuid: user.uuid,
      };
      const resp = await fetch("/api/update-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req),
      });
      if (!resp.ok) {
        throw new Error("update invite failed with status: " + resp.status);
      }
      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      setUser(data);
      cacheRemove(CacheKey.InviteCode);
    } catch (e) {
      log.error("更新邀请关系失败", e as Error, { function: "updateInvite" });
    }
  }, []);

  const fetchUserInfo = useCallback(async function () {
    // 防止重复请求
    if (fetchingUserInfo.current) {
      log.debug("请求进行中，跳过重复调用", { function: "fetchUserInfo" });
      return;
    }

    try {
      fetchingUserInfo.current = true;
      setUserLoading(true);
      log.debug("开始获取用户信息", { function: "fetchUserInfo" });

      const resp = await fetch("/api/get-user-info", {
        method: "POST",
      });

      if (!resp.ok) {
        throw new Error("fetch user info failed with status: " + resp.status);
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      setUser(data);
      log.debug("用户信息获取成功", {
        function: "fetchUserInfo",
        user_uuid: data.uuid
      });

      // 设置管理员状态（从用户信息中获取）
      const adminStatus = data.isAdmin || false;
      setIsAdmin(adminStatus);

      // 缓存管理员状态（会话级别缓存，无过期时间）
      cacheSet(CacheKey.AdminStatus, adminStatus.toString(), -1);

      log.debug("管理员权限状态", {
        isAdmin: adminStatus,
        function: "fetchUserInfo",
        user_uuid: data.uuid,
        cached: true,
        cacheType: "session"
      });

      updateInvite(data);
    } catch (e) {
      log.error("获取用户信息失败", e as Error, { function: "fetchUserInfo" });
    } finally {
      setUserLoading(false);
      fetchingUserInfo.current = false;
    }
  }, [updateInvite]);

  useEffect(() => {
    // 只有当 session 真正变化时才重新获取用户信息
    const currentSessionId = session?.user?.email || null;

    if (session && session.user && currentSessionId !== lastSessionId.current) {
      log.debug("Session 变化，获取用户信息", {
        currentSessionId,
        function: "useEffect"
      });
      lastSessionId.current = currentSessionId;
      fetchUserInfo();
    } else if (!session && lastSessionId.current) {
      // 用户登出时清理状态
      log.debug("用户登出，清理状态", { function: "useEffect" });
      lastSessionId.current = null;
      setUser(null);
      setIsAdmin(false);
      // 清理管理员状态缓存
      cacheRemove(CacheKey.AdminStatus);
    }
  }, [session, fetchUserInfo]);

  // 使用 useMemo 优化 context value
  const contextValue = useMemo(() => ({
    theme,
    setTheme,
    showSignModal,
    setShowSignModal,
    user,
    setUser,
    userLoading,
    showFeedback,
    setShowFeedback,
    isAdmin,
  }), [
    theme,
    showSignModal,
    user,
    userLoading,
    showFeedback,
    isAdmin,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
