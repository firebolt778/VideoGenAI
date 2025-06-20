import { Button } from "@/components/ui/button";
import { RefreshCw, Plus } from "lucide-react";

interface HeaderProps {
  title: string;
  description: string;
  onRefresh?: () => void;
  onAdd?: () => void;
  addButtonText?: string;
  showAddButton?: boolean;
  showRefreshButton?: boolean;
}

export default function Header({
  title,
  description,
  onRefresh,
  onAdd,
  addButtonText = "Add",
  showAddButton = true,
  showRefreshButton = true,
}: HeaderProps) {
  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex items-center space-x-4">
          {showRefreshButton && onRefresh && (
            <Button
              variant="outline"
              onClick={onRefresh}
              className="text-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          )}
          {showAddButton && onAdd && (
            <Button
              onClick={onAdd}
              className="text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              {addButtonText}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
