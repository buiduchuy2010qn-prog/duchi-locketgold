const fs = require('fs');
let content = fs.readFileSync('src/pages/Public/AdminUsers/index.jsx', 'utf8');

const searchString = `                <div className={\`text-sm font-black truncate \${advancedSubTab === "heartbeat" ? "text-white" : "text-slate-100"}\`}>Giám Sát Sóng API</div>
              </div>
            </button>
          </div>`;

const replaceString = `                <div className={\`text-sm font-black truncate \${advancedSubTab === "heartbeat" ? "text-white" : "text-slate-100"}\`}>Giám Sát Sóng API</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAdvancedSubTab("whitelist")}
              className={\`flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-300 cursor-pointer text-left shadow-sm border relative overflow-hidden \${
                advancedSubTab === "whitelist"
                  ? "bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white border-green-500/50 shadow-lg shadow-green-500/30 scale-[1.01]"
                  : "bg-slate-900/90 text-slate-300 border-slate-800/80 hover:border-green-500/40 hover:bg-slate-800 hover:text-white"
              }\`}
            >
              <div className={\`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 \${advancedSubTab === "whitelist" ? "bg-white/20 text-green-200 shadow-md scale-105" : "bg-green-950/80 border border-green-500/30 text-green-400"}\`}>
                <ShieldCheck size={24} className={advancedSubTab === "whitelist" ? "animate-pulse" : ""} />
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] font-extrabold uppercase tracking-widest mb-0.5 flex items-center gap-1">
                  <span className={advancedSubTab === "whitelist" ? "text-green-200" : "text-slate-500"}>AN TOÀN HỆ THỐNG</span>
                  {advancedSubTab === "whitelist" && <span className="w-1.5 h-1.5 rounded-full bg-green-200 animate-ping" />}
                </div>
                <div className={\`text-sm font-black truncate \${advancedSubTab === "whitelist" ? "text-white" : "text-slate-100"}\`}>Kim Bài Miễn Tử</div>
              </div>
            </button>
          </div>`;

if (content.includes(searchString)) {
  fs.writeFileSync('src/pages/Public/AdminUsers/index.jsx', content.replace(searchString, replaceString));
  console.log("Success");
} else {
  console.log("Search string not found");
}
