const fs = require('fs');
const path = 'src/pages/Public/AdminUsers/index.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add fetch logic to fetchAdvancedData
const fetchTarget = '        const p = await adminRequest(`/ip-blacklist?_=${Date.now()}`);\n        if (p?.list) setBlacklistedIps(p.list || []);';
if (content.includes(fetchTarget) && !content.includes('/whitelist')) {
  content = content.replace(fetchTarget, fetchTarget + '\n        const w = await adminRequest(`/whitelist?_=${Date.now()}`);\n        if (w?.list) setWhitelistItems(w.list || []);');
}

// 2. Add the Whitelist Tab Button
const whitelistButton = `
              <button
                type="button"
                onClick={() => setAdvancedSubTab("whitelist")}
                className={\`flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-300 cursor-pointer text-left shadow-sm border relative overflow-hidden \${
                  advancedSubTab === "whitelist"
                    ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white border-emerald-500/50 shadow-lg shadow-emerald-500/30 scale-[1.01]"
                    : "bg-slate-900/90 text-slate-300 border-slate-800/80 hover:border-emerald-500/40 hover:bg-slate-800 hover:text-white"
                }\`}
              >
                <div className={\`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 \${advancedSubTab === "whitelist" ? "bg-white/20 text-yellow-200 shadow-md scale-105" : "bg-emerald-950/80 border border-emerald-500/30 text-emerald-400"}\`}>
                  <Shield size={24} className={advancedSubTab === "whitelist" ? "animate-pulse" : ""} />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest mb-0.5 flex items-center gap-1">
                    <span className={advancedSubTab === "whitelist" ? "text-emerald-200" : "text-slate-500"}>WHITELIST</span>
                    {advancedSubTab === "whitelist" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-ping" />}
                  </div>
                  <div className={\`text-sm font-black truncate \${advancedSubTab === "whitelist" ? "text-white" : "text-slate-100"}\`}>Kim Bài Miễn Tử</div>
                </div>
              </button>
`;

const btnTarget = 'text-slate-100"}`}>Giám Sát Sống API</div>\n                </div>\n              </button>';
if (content.includes(btnTarget) && !content.includes('advancedSubTab === "whitelist"')) {
  content = content.replace(btnTarget, btnTarget + '\n' + whitelistButton);
}

// 3. Add the Whitelist UI Section
const whitelistUI = `
            {/* Section: Whitelist */}
            {advancedSubTab === "whitelist" && (
              <div className="bg-slate-950 text-slate-100 rounded-[2.5rem] p-6 sm:p-9 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border border-slate-800/80 relative overflow-hidden animate-fade-in backdrop-blur-2xl">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-emerald-600/15 rounded-full blur-[140px] pointer-events-none -mt-32 -mr-32" />

                <div className="relative z-10 mb-8 pb-6 border-b border-slate-800/80">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-black mb-2 shadow-sm">
                    <span>🛡️ WAF FIREWALL BYPASS</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-white to-teal-200">
                    Kim Bài Miễn Tử (Danh Sách Trắng)
                  </h3>
                  <p className="text-sm text-slate-400 font-medium mt-1 max-w-3xl leading-relaxed">
                    Những tài khoản hoặc địa chỉ IP nằm trong danh sách này sẽ hoàn toàn KHÔNG BỊ BAN dưới mọi hình thức. Tường lửa WAF sẽ tự động bỏ qua kiểm tra cho họ.
                  </p>
                </div>
                
                <div className="relative z-10 space-y-6 flex-1 w-full">
                  <div className="bg-slate-900/90 p-6 rounded-3xl border border-slate-800/80 shadow-inner w-full">
                    <label className="label text-xs font-black uppercase tracking-wider text-emerald-300 pb-2">
                      🛡️ Cấp Kim Bài Miễn Tử Mới:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select 
                        value={whitelistType}
                        onChange={(e) => setWhitelistType(e.target.value)}
                        className="select select-bordered rounded-2xl font-bold text-sm bg-slate-950 text-white border-slate-800 focus:border-emerald-500 h-12 shadow-sm"
                      >
                        <option value="email">Email Account</option>
                        <option value="ip">IP Address</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Nhập Email hoặc IP..."
                        value={whitelistInput}
                        onChange={(e) => setWhitelistInput(e.target.value)}
                        className="input input-bordered flex-1 rounded-2xl font-bold text-sm bg-slate-950 text-white border-slate-800 focus:border-emerald-500 placeholder:text-slate-600 h-12 shadow-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && whitelistInput.trim()) {
                            document.getElementById("btn-add-whitelist").click();
                          }
                        }}
                      />
                      <button
                        id="btn-add-whitelist"
                        className="btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black h-12 px-6 rounded-2xl border-0 shadow-lg shadow-emerald-600/20 shrink-0 transition-all active:scale-95"
                        onClick={async () => {
                          if (!whitelistInput.trim()) return;
                          try {
                            const action = async () => {
                                await adminRequest("/whitelist", {
                                method: "POST",
                                body: JSON.stringify({ identifier: whitelistInput.trim(), type: whitelistType })
                                });
                                setWhitelistInput("");
                                const res = await adminRequest(\`/whitelist?_=\${Date.now()}\`);
                                if (res?.list) setWhitelistItems(res.list);
                                SonnerSuccess("Đã thêm vào danh sách miễn trừ!");
                            };
                            handleActionWithSessionCheck(action);
                          } catch (error) {
                            SonnerWarning(error.message || "Lỗi thêm whitelist");
                          }
                        }}
                      >
                        ➕ Thêm Miễn Trừ
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                        📋 Danh Sách Miễn Trừ (Whitelist)
                      </h4>
                      <span className="badge bg-slate-900 text-slate-300 border border-slate-800 font-black text-xs px-3 py-2.5 rounded-xl">{whitelistItems.length} Mục</span>
                    </div>

                    <div className="overflow-x-auto border border-slate-800/80 rounded-2xl bg-slate-900/90 shadow-inner max-h-96 overflow-y-auto">
                      <table className="table w-full text-sm font-medium">
                        <thead className="bg-slate-950 font-extrabold text-slate-300 uppercase text-xs tracking-wider sticky top-0 z-10 border-b border-slate-800/80">
                          <tr>
                            <th className="py-3.5 pl-5">Loại Phân Loại</th>
                            <th>Định Danh (Email / IP)</th>
                            <th>Ngày Thêm</th>
                            <th className="text-right pr-5">Hành Động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {whitelistItems.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="text-center py-12 text-slate-500 font-semibold">
                                Chưa có ai trong danh sách miễn trừ.
                              </td>
                            </tr>
                          ) : (
                            whitelistItems.map((item) => (
                              <tr key={item.identifier} className="hover:bg-slate-800/50 transition-colors">
                                <td className="py-3.5 pl-5 font-bold">
                                  <span className="badge bg-emerald-950/80 text-emerald-300 border-emerald-500/30 uppercase text-[10px] font-black px-2 py-1 rounded-lg">
                                    {item.type}
                                  </span>
                                </td>
                                <td className="font-bold text-white">
                                  {item.identifier}
                                </td>
                                <td className="font-mono text-xs text-slate-400">{new Date(item.created_at).toLocaleString("vi-VN")}</td>
                                <td className="text-right pr-5">
                                  <button
                                    onClick={async () => {
                                      if (confirm(\`Gỡ \${item.identifier} khỏi danh sách miễn trừ?\`)) {
                                        const action = async () => {
                                            await adminRequest(\`/whitelist/\${encodeURIComponent(item.identifier)}\`, { method: "DELETE" });
                                            const res = await adminRequest(\`/whitelist?_=\${Date.now()}\`);
                                            if (res?.list) setWhitelistItems(res.list);
                                            SonnerSuccess("Đã gỡ khỏi danh sách miễn trừ!");
                                        };
                                        handleActionWithSessionCheck(action);
                                      }
                                    }}
                                    className="btn btn-xs bg-rose-950/60 hover:bg-rose-600/90 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500/0 rounded-xl transition-all duration-300"
                                  >
                                    <Trash2 size={14} className="mr-1" /> Gỡ Bỏ
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
`;

const sectionTarget = '{/* Section 4: Live API & Integration Heartbeat Monitor */}';
if (content.includes(sectionTarget) && !content.includes('Kim Bài Miễn Tử (Danh Sách Trắng)')) {
  content = content.replace(sectionTarget, whitelistUI + '\n\n            ' + sectionTarget);
}

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully injected Whitelist into its own tab.");
