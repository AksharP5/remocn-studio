import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LabButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      size={null}
      variant="ghost"
      {...props}
      className={cn(
        "h-10 gap-2 rounded-md border-0 bg-transparent px-3 font-normal text-sm text-inherit shadow-none before:hidden hover:bg-white/6 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-[#c7c7c0] focus-visible:outline-offset-2 pointer-coarse:min-h-11 [&_svg]:opacity-100",
        className
      )}
    />
  );
}
