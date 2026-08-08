import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import AccountHealth from "@/features/SlotMonitor/AccountHealth";
import CelebCenterOverview from "@/features/SlotMonitor/CelebCenterOverview";
import SystemStatus from "@/features/SlotMonitor/SystemStatus";
import AdminSystemHealth from "../AdminSystemHealth";

export default function AdminOperations() {
  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-8 md:pt-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-base-content/10 bg-base-200/45 p-5 shadow-sm backdrop-blur-md md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex items-start gap-3">
            <Link
              to="/admin/users"
              className="btn btn-circle btn-ghost btn-sm border border-base-content/10"
              title="Quay lại quản lý người dùng"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-extrabold md:text-3xl">
                <ShieldCheck className="h-7 w-7 text-primary" />
                Vận hành Admin
              </h1>
              <p className="mt-1 text-sm text-base-content/65">
                Celeb Center, sức khỏe tài khoản Canh Slot và trạng thái backend chỉ hiển thị trong khu vực quản trị.
              </p>
            </div>
          </div>
          <Link to="/friends?slot=1" className="btn btn-sm btn-outline rounded-full">
            Xem trang Canh Slot người dùng
          </Link>
        </div>
      </div>

      <section className="pt-4" aria-label="Vận hành Canh Slot">
        <CelebCenterOverview />
        <AccountHealth />
        <SystemStatus />
      </section>

      <div className="mx-auto mt-2 w-full max-w-6xl px-4 md:px-8">
        <div className="border-t border-base-content/10" />
      </div>

      <AdminSystemHealth />
    </div>
  );
}
