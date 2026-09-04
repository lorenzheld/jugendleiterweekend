/**
 * App – root router / shell.
 * Route guards will be added in Epic 2 (Auth).
 */
export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#1a1a2e] text-[#f4e4c1]">
      <h1 className="font-serif text-3xl font-bold tracking-wide">
        JLW 2026 ⚔️
      </h1>
      <p className="mt-2 text-sm text-[#cd7f32]">Player Client – coming soon</p>
    </div>
  );
}
