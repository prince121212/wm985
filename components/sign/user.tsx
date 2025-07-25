"use client";

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import Link from "next/link";
import { User } from "@/types/user";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useAppContext } from "@/contexts/app";

export default function SignUser({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const t = useTranslations();
  const { isAdmin } = useAppContext();
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Avatar className="cursor-pointer">
          <AvatarImage src={user.avatar_url} alt={user.nickname} />
          <AvatarFallback>{user.nickname}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="mx-4">
        <DropdownMenuLabel className="text-center truncate">
          {user.nickname}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem className="flex justify-center cursor-pointer" asChild>
          <Link href="/user-center" onClick={() => {
            setOpen(false);
            onNavigate?.();
          }}>
            {t("user.user_center")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* 只有管理员才显示管理后台入口 */}
        {isAdmin && (
          <>
            <DropdownMenuItem className="flex justify-center cursor-pointer" asChild>
              <Link href="/admin/users" target="_blank" onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}>
                {t("user.admin_system")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem
          className="flex justify-center cursor-pointer"
          onClick={() => {
            setOpen(false);
            onNavigate?.();
            localStorage.removeItem('USER_INFO');
            localStorage.removeItem('ADMIN_STATUS');
            signOut();
          }}
        >
          {t("user.sign_out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
