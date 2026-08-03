const fs = require('fs');
const path = 'src/pages/Public/AdminUsers/index.jsx';
let content = fs.readFileSync(path, 'utf8');

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

// Insert the button
const btnTarget = 'text-slate-100"}`}>Giám Sát Sống API</div>\n                </div>\n              </button>';
if(!content.includes(btnTarget)) throw new Error("Could not find button target");
content = content.replace(btnTarget, btnTarget + '\n' + whitelistButton);

// Extract the Whitelist UI. It starts after the "Lịch Sử Cấm Cửa" table in Blacklist
// I will just find the text "Kim Bài Miễn Tử" and find its enclosing div.
const pStart = content.indexOf('<div className="mt-8 bg-slate-900/90 p-6 rounded-3xl border border-slate-800/80 shadow-inner w-full">');
const pEndMarker = '</thead>\n                          <tbody'; // wait, the end is the end of the table
// Let's use a regex to extract the whole `<div className="mt-8 bg-slate-900/90 ...>` that contains the whitelist
// Or better, I can just find the start and end string manually.
