import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getAnalytics } from "@/actions/get-analytics";
import { DataCard } from "@/components/admin/data-card";
import { Chart } from "./_components/chart";
import { PageContainer } from "@/components/shell/page-container";

const AnalyticsPage = async () => {
    const { userId } = await auth();

    if (!userId) {
        return redirect("/dashboard");
    }

    const {
        data,
        totalRevenue,
        totalSales,
    } = await getAnalytics(userId);
    return ( 
        <PageContainer width="wide">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <DataCard 
                    label="Total Revenue"
                    value={totalRevenue}
                    shouldFormat
                />
                <DataCard 
                    label="Total Sales"
                    value={totalSales}
                />
            </div>
            <Chart 
                data={data}
            />
        </PageContainer>
     );
}
 
export default AnalyticsPage;