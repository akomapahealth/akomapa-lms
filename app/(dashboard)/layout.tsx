import { Navbar } from "./_components/navbar";
import { Sidebar } from "./_components/sidebar";

const DashboardLayout = ({
    children
}: {
    children: React.ReactNode
}) => {
    return ( 
        <div className="h-full">
            <div className="max-md:hidden flex h-full w-56 flex-col fixed inset-y-0 left-0 z-[60]">
                <Sidebar />
            </div>
            <main className="md:pl-56 pt-[80px] h-full">
                <div className="fixed top-0 left-0 right-0 z-50 h-[80px]">
                    <Navbar />
                </div>
                {children}
            </main>
        </div>
     );
}
 
export default DashboardLayout;
