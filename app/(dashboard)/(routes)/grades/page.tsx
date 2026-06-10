import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const GradesPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Grades</h1>
      </div>
      <div className="flex items-center justify-center h-[400px] border border-dashed border-slate-300 rounded-lg">
        <div className="text-center">
          <p className="text-slate-500 text-lg">Your grades and quiz scores will appear here</p>
          <p className="text-slate-400 text-sm mt-1">Coming in Phase 3</p>
        </div>
      </div>
    </div>
  );
};

export default GradesPage;
