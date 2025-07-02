import { Button } from "@/components/ui/button";
import { Button as ButtonType } from "@/types/blocks/base";
import Icon from "@/components/icon";
import Link from "next/link";

export default function Toolbar({ items, onAction }: {
  items?: ButtonType[];
  onAction?: (action: string) => void;
}) {
  return (
    <div className="flex space-x-4 mb-8">
      {items?.map((item, idx) => {
        // 如果是action类型的按钮
        if (item.action) {
          return (
            <Button
              key={idx}
              variant={item.variant}
              size="sm"
              className={item.className}
              onClick={() => onAction?.(item.action!)}
            >
              <div className="flex items-center gap-1">
                {item.title}
                {item.icon && <Icon name={item.icon} />}
              </div>
            </Button>
          );
        }

        // 默认的链接类型按钮
        return (
          <Button
            key={idx}
            variant={item.variant}
            size="sm"
            className={item.className}
          >
            <Link
              href={item.url || ""}
              target={item.target}
              className="flex items-center gap-1"
            >
              {item.title}
              {item.icon && <Icon name={item.icon} />}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
