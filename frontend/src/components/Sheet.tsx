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
        className="rounded-t-3xl max-w-lg mx-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetHeader>
          <SheetTitle className="text-lg">{title}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-2">{children}</div>
      </SheetContent>
    </SheetRoot>
  );
}
