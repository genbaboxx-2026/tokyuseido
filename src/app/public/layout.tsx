export const metadata = {
  title: "360度評価 | NiNKU BOXX",
  description: "360度評価フォーム",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {children}
    </div>
  );
}
