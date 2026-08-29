import { SyncSetupForm } from "@/components/SyncSetupForm";

export default function SyncPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Sincronización</h1>
        <p className="text-sm text-neutral-500">
          Cifrado de extremo a extremo. El servidor nunca ve tus datos en claro.
        </p>
      </div>
      <SyncSetupForm />
    </div>
  );
}
