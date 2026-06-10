import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const CommunityPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Community</h1>
      </div>
      <div className="flex items-center justify-center h-[400px] border border-dashed border-slate-300 rounded-lg">
        <div className="text-center">
          <p className="text-slate-500 text-lg">Connect with other GHELP students</p>
          <p className="text-slate-400 text-sm mt-1">Coming in Phase 4</p>
        </div>
      </div>
    </div>
  );
};

export default CommunityPage;
