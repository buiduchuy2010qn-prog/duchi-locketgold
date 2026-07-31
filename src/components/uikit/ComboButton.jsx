import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * Combo Button (Split Style) mô phỏng NSComboButton của macOS
 * 
 * @param {string} label - Tên của hành động chính
 * @param {function} onMainClick - Hàm được gọi khi nhấn vào phần chính
 * @param {Array} menuItems - Danh sách các mục trong dropdown menu
 */
const ComboButton = ({ label, onMainClick, menuItems = [] }) => {
  return (
    <div className="join shadow-sm hover:shadow-md transition-shadow">
      {/* Vùng chính (Main Region) */}
      <button 
        type="button"
        className="btn btn-primary join-item px-6"
        onClick={onMainClick}
      >
        {label}
      </button>
      
      {/* Vùng mũi tên (Arrow Region) - Mở Dropdown */}
      <div className="dropdown dropdown-end join-item">
        <div 
          tabIndex={0} 
          role="button" 
          className="btn btn-primary join-item px-2 border-l-primary-content/20"
          aria-label="More options"
        >
          <ChevronDown size={18} />
        </div>
        
        {/* NSMenu (Dropdown Content) */}
        <ul 
          tabIndex={0} 
          className="dropdown-content z-[60] menu p-2 mt-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-200"
        >
          {menuItems.map((item, index) => (
            <li key={item.id || index}>
              <a 
                onClick={() => {
                  if (item.onClick) item.onClick();
                  if (document.activeElement) {
                    document.activeElement.blur();
                  }
                }}
                className={item.danger ? "text-error hover:bg-error/10" : ""}
              >
                {item.icon && <span className="mr-2">{item.icon}</span>}
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ComboButton;
