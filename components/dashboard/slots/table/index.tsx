import Header from "@/components/dashboard/header";
import TableBlock from "@/components/blocks/table";
import { Table as TableSlotType } from "@/types/slots/table";
import Toolbar from "@/components/blocks/toolbar";

interface TableSlotProps extends TableSlotType {
  onAction?: (action: string) => void;
}

export default function ({ onAction, ...table }: TableSlotProps) {
  return (
    <>
      <Header crumb={table.crumb} />
      <div className="w-full px-4 md:px-8 py-8">
        <h1 className="text-2xl font-medium mb-8">{table.title}</h1>
        {table.description && (
          <p className="text-sm text-muted-foreground mb-8">
            {table.description}
          </p>
        )}
        {table.tip && (
          <p className="text-sm text-muted-foreground mb-8">
            {table.tip.description || table.tip.title}
          </p>
        )}
        {table.toolbar && <Toolbar items={table.toolbar.items} onAction={onAction} />}
        <div className="overflow-x-auto">
          <TableBlock columns={table.columns} data={table.data} />
        </div>
      </div>
    </>
  );
}
