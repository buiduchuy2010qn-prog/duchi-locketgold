const fs = require('fs');
const path = 'src/pages/Public/AdminUsers/index.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add state variables
const stateVars = `
  const [blacklistItems, setBlacklistItems] = useState([]);
  const [blacklistInput, setBlacklistInput] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");

  const [whitelistItems, setWhitelistItems] = useState([]);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [whitelistType, setWhitelistType] = useState("email");
`;
content = content.replace(
  'const [blacklistItems, setBlacklistItems] = useState([]);\n  const [blacklistInput, setBlacklistInput] = useState("");\n  const [blacklistReason, setBlacklistReason] = useState("");',
  stateVars
);

// 2. Fetch both lists in the useEffect for blacklist
const fetchEffect = `
  useEffect(() => {
    if (advancedSubTab === "blacklist") {
      const fetchLists = async () => {
        try {
          const bRes = await adminRequest("/ip-blacklist");
          if (bRes?.list) setBlacklistItems(bRes.list);
          const wRes = await adminRequest("/whitelist");
          if (wRes?.list) setWhitelistItems(wRes.list);
        } catch (e) {}
      };
      fetchLists();
    }
  }, [advancedSubTab]);
`;
content = content.replace(
  /useEffect\(\(\) => {\s*if \(advancedSubTab === "blacklist"\) {\s*adminRequest\("\/ip-blacklist"\)[\s\S]*?}\s*}, \[advancedSubTab\]\);/,
  fetchEffect
);

// 3. Add Whitelist UI in the blacklist tab
const whitelistUI = `
                  <div className="mt-8 bg-slate-900/90 p-6 rounded-3xl border border-slate-800/80 shadow-inner max-w-4xl">
                    <label className="label text-xs font-black uppercase tracking-wider text-emerald-300 pb-2">
                      🛡️ Kim Bài Miễn Tử (Danh Sách Trắng):
                    </label>
                    <p className="text-sm text-slate-400 font-medium mb-5 max-w-3xl leading-relaxed">
                      Thêm Email hoặc IP vào danh sách này để hệ thống WAF bỏ qua mọi kiểm tra. Người dùng trong danh sách sẽ KHÔNG BAO GIỜ bị ban, kể cả khi họ spam (rất hữu ích cho Admin hoặc Tester).
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select 
                        value={whitelistType}
                        onChange={(e) => setWhitelistType(e.target.value)}
                        className="select select-bordered rounded-2xl font-bold text-sm bg-slate-950 text-white border-slate-800 focus:border-emerald-500 h-12 shadow-sm"
                      >
                        <option value="email">Email</option>
                        <option value="ip">IP Address</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Nhập Email hoặc IP..."
                        value={whitelistInput}
                        onChange={(e) => setWhitelistInput(e.target.value)}
                        className="input input-bordered w-full rounded-2xl font-bold text-sm bg-slate-950 text-white border-slate-800 focus:border-emerald-500 placeholder:text-slate-600 h-12 shadow-sm"
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && whitelistInput.trim()) {
                            try {
                              await adminRequest("/whitelist", {
                                method: "POST",
                                body: JSON.stringify({ identifier: whitelistInput.trim(), type: whitelistType })
                              });
                              setWhitelistInput("");
                              const res = await adminRequest("/whitelist");
                              if (res?.list) setWhitelistItems(res.list);
                              SonnerSuccess("Đã thêm vào danh sách miễn trừ!");
                            } catch (error) {
                              SonnerWarning(error.message || "Lỗi thêm whitelist");
                            }
                          }
                        }}
                      />
                      <button
                        className="btn bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 px-6 rounded-2xl border-0 shadow-lg shadow-emerald-600/20 shrink-0"
                        onClick={async () => {
                          if (!whitelistInput.trim()) return;
                          try {
                            await adminRequest("/whitelist", {
                              method: "POST",
                              body: JSON.stringify({ identifier: whitelistInput.trim(), type: whitelistType })
                            });
                            setWhitelistInput("");
                            const res = await adminRequest("/whitelist");
                            if (res?.list) setWhitelistItems(res.list);
                            SonnerSuccess("Đã thêm vào danh sách miễn trừ!");
                          } catch (error) {
                            SonnerWarning(error.message || "Lỗi thêm whitelist");
                          }
                        }}
                      >
                        Thêm Miễn Trừ
                      </button>
                    </div>
                  </div>

                  <div className="mt-10 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                        🛡️ Danh Sách Miễn Trừ (Whitelist)
                      </h4>
                      <span className="badge bg-slate-900 text-slate-300 border border-slate-800 font-black text-xs px-3 py-2.5 rounded-xl">{whitelistItems.length} Mục</span>
                    </div>

                    <div className="overflow-x-auto border border-slate-800/80 rounded-2xl bg-slate-900/90 shadow-inner max-h-96 overflow-y-auto mb-10">
                      <table className="table w-full text-sm font-medium">
                        <thead className="bg-slate-950 font-extrabold text-slate-300 uppercase text-xs tracking-wider sticky top-0 z-10 border-b border-slate-800/80">
                          <tr>
                            <th className="py-3.5 pl-5">Loại</th>
                            <th>Định Danh (Email/IP)</th>
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
                                <td>{new Date(item.created_at).toLocaleString("vi-VN")}</td>
                                <td className="text-right pr-5">
                                  <button
                                    onClick={async () => {
                                      if (confirm(\`Gỡ \${item.identifier} khỏi danh sách miễn trừ?\`)) {
                                        await adminRequest(\`/whitelist/\${encodeURIComponent(item.identifier)}\`, { method: "DELETE" });
                                        const res = await adminRequest("/whitelist");
                                        if (res?.list) setWhitelistItems(res.list);
                                        SonnerSuccess("Đã gỡ khỏi danh sách miễn trừ!");
                                      }
                                    }}
                                    className="btn btn-sm bg-rose-950/60 hover:bg-rose-600/90 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500/0 rounded-xl transition-all duration-300"
                                  >
                                    <Trash2 size={16} /> Gỡ Bỏ
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
`;

content = content.replace(
  '                  <div className="mt-10 relative z-10">',
  whitelistUI + '\n                  <div className="mt-10 relative z-10">'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched AdminUsers.jsx');
