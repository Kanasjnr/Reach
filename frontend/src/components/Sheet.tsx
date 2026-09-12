import {
  Sheet as SheetRoot,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <SheetRoot open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-[32px] max-w-lg mx-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <SheetHeader className="items-center text-center">
          <SheetTitle className="text-lg">{title}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-2">{children}</div>
      </SheetContent>
    </SheetRoot>
  );
}
