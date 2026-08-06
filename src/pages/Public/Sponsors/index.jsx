import React from "react";
import { Heart, Coffee } from "lucide-react";
import { Link } from "react-router-dom";
import { SPONSORS_CONFIG } from "@/config";
const DonatePage = () => {

  return (
    <div className="min-h-screen bg-base-200 py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center items-center gap-2 mb-2">
            <Heart className="w-6 h-6 text-error animate-pulse" />
            <h1 className="text-3xl md:text-3xl font-bold text-base-content">
              Ủng hộ dự án
            </h1>
            <Heart className="w-6 h-6 text-error animate-pulse" />
          </div>
          <p className="text-secondary text-sm md:text-base max-w-lg mx-auto">
            Mọi đóng góp giúp duy trì và cải thiện website. Dù chỉ là một số
            tiền nhỏ nhưng là sự đóng góp lớn đối với mình. Bạn cũng có thể ủng
            hộ bằng cách{" "}
            <Link to="/pricing" className="underline font-medium text-primary">
              mua gói thành viên
            </Link>{" "}
            ❤️‍🔥. Cảm ơn sự ủng hộ của bạn!
          </p>
        </div>

        {/* Stats Cards */}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "Tổng đóng góp",
              value: `${totalDonations.toLocaleString()}₫`,
              icon: <Gift className="w-5 h-5 text-success" />,
            },
            {
              label: "Người ủng hộ",
              value: donations.length,
              icon: <UsersRound className="w-5 h-5 text-primary" />,
            },
            {
              label: "Đã chi tiêu",
              value: `${spentAmount.toLocaleString()}₫`,
              icon: <CreditCard className="w-5 h-5 text-warning" />,
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="bg-base-200 rounded-lg p-4 shadow-md border border-base-300 flex items-center gap-3"
            >
              <div className="p-2 bg-base-300 rounded-full">{stat.icon}</div>
              <div>
                <p className="text-secondary text-xs md:text-sm">
                  {stat.label}
                </p>
                <p className="text-lg md:text-xl font-semibold text-base-content">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div> */}

        {/* Main Grid */}
        <div className="max-w-md mx-auto">
          {/* Donate Section */}
          <div className="bg-base-100 rounded-2xl p-6 shadow-md border border-base-300">
            <div className="text-center mb-4">
              <div className="flex justify-center items-center gap-2 mb-3 text-lg font-semibold text-base-content">
                <Coffee className="w-5 h-5 text-amber-500" /> Give me a coffee
              </div>
              <img
                src={SPONSORS_CONFIG.urlImg}
                alt="QR Code Donate"
                className="w-52 h-52 mx-auto rounded-lg shadow-sm"
              />
            </div>
            <div className="mt-4 space-y-2 text-sm text-base-content">
              <div className="p-3 border border-base-300 rounded">
                NH: <span className="font-semibold">{SPONSORS_CONFIG.bankName}</span>
              </div>
              <div className="p-3 border border-base-300 rounded">
                STK: <span className="font-semibold">{SPONSORS_CONFIG.accountNumber}</span>
              </div>
              <div className="p-3 border border-base-300 rounded">
                CTK: <span className="font-semibold">{SPONSORS_CONFIG.accountName}</span>
              </div>
            </div>
            <p className="mt-4 text-base-content text-sm text-left">
              Mỗi đóng góp là động lực để mình tiếp tục phát triển và duy trì website ☕.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DonatePage;
