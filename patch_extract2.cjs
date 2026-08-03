const fs = require('fs');
const path = 'src/pages/Public/AdminUsers/index.jsx';
let content = fs.readFileSync(path, 'utf8');

// The whitelist tab button
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

// Insert the button after the heartbeat button
const btnTarget = '<div className={`text-sm font-black truncate ${advancedSubTab === "heartbeat" ? "text-white" : "text-slate-100"}`}>Giám Sát Sống API</div>\n                </div>\n              </button>';
if(content.includes(btnTarget)) {
  content = content.replace(btnTarget, btnTarget + '\\n' + whitelistButton);
} else {
  console.log("Could not find button target");
  process.exit(1);
}

// 2. Extract Whitelist UI from Blacklist block
const startMarker = '                  {/* Whitelist Section Inside Blacklist */}\n                  <div className="mt-8 bg-slate-900/90 p-6 rounded-3xl border border-slate-800/80 shadow-inner max-w-4xl">';
const endMarker = '                          )}\n                        </tbody>\n                      </table>\n                    </div>\n                  </div>';

const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.log("Could not find start marker for UI");
  process.exit(1);
}

const endIndex = content.indexOf(endMarker, startIndex) + endMarker.length;
let whitelistUI = content.substring(startIndex, endIndex);

// Remove it from Blacklist block
content = content.substring(0, startIndex) + content.substring(endIndex);

whitelistUI = whitelistUI.replace('mt-8', 'mt-0').replace('max-w-4xl', 'w-full flex-1');

// Create the new Whitelist section
const whitelistSection = `
            {/* Section: Whitelist */}
            {advancedSubTab === "whitelist" && (
              <div className="bg-slate-950 text-slate-100 rounded-[2.5rem] p-6 sm:p-9 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border border-slate-800/80 relative overflow-hidden animate-fade-in backdrop-blur-2xl">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-emerald-600/15 rounded-full blur-[140px] pointer-events-none -mt-32 -mr-32" />

                <div className="relative z-10 mb-8 pb-6 border-b border-slate-800/80">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-black mb-2 shadow-sm">
                    <span>🛡️ WAF FIREWALL BYPASS</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-white to-teal-200">
                    Kim Bài Miễn Tử (Whitelist)
                  </h3>
                  <p className="text-sm text-slate-400 font-medium mt-1 max-w-3xl leading-relaxed">
                    Những tài khoản hoặc địa chỉ IP nằm trong danh sách này sẽ hoàn toàn KHÔNG BỊ BAN dưới mọi hình thức. Tường lửa WAF sẽ tự động bỏ qua kiểm tra cho họ.
                  </p>
                </div>
                <div className="relative z-10 space-y-6 flex-1 w-full">
                  ${whitelistUI.replace('{/* Whitelist Section Inside Blacklist */}\\n                  ', '')}
                </div>
              </div>
            )}
`;

const sectionTarget = '{/* Section 4: Live API & Integration Heartbeat Monitor */}';
content = content.replace(sectionTarget, whitelistSection + '\\n            ' + sectionTarget);

fs.writeFileSync(path, content, 'utf8');
console.log('Whitelist extracted to its own tab successfully.');
