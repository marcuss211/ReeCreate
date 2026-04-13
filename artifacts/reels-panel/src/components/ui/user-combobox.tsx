import { useState, useRef } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface UserOption {
  id: number;
  name: string;
  username: string;
  personnelNo?: number | null;
}

interface UserComboboxProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  users: UserOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function UserCombobox({
  value,
  onChange,
  users,
  placeholder = "Kullanıcı seçin veya arayın...",
  disabled,
}: UserComboboxProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = users.find((u) => u.id === value);

  function getLabel(u: UserOption) {
    const parts = [u.name];
    if (u.personnelNo) parts.push(`#${u.personnelNo}`);
    if (u.username) parts.push(`@${u.username}`);
    return parts.join(" · ");
  }

  function customFilter(itemValue: string, search: string): number {
    const q = search.toLowerCase().trim();
    if (!q) return 1;
    const user = users.find((u) => String(u.id) === itemValue);
    if (!user) return 0;
    const haystack = [
      user.name,
      user.username,
      user.personnelNo ?? "",
      String(user.id),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q) ? 1 : 0;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground"
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selected ? getLabel(selected) : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0"
        style={{ width: triggerRef.current?.offsetWidth ?? 320 }}
        align="start"
      >
        <Command filter={customFilter}>
          <CommandInput placeholder="Ad, kullanıcı adı veya ID ara..." />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              Kullanıcı bulunamadı
            </CommandEmpty>
            <CommandGroup>
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={String(u.id)}
                  onSelect={() => {
                    onChange(u.id === value ? undefined : u.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === u.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{u.username}
                      {u.personnelNo && (
                        <span className="ml-2 font-mono">#{u.personnelNo}</span>
                      )}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
