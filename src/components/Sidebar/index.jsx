import React, { useEffect, useRef, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  X,
  Home,
  Upload,
  Smartphone,
  Rocket,
  Info,
  ShieldCheck,
  Wrench,
  BookText,
  UserCircle,
  Clock,
  Bug,
  Settings,
  Palette,
  UserRound,
  LifeBuoy,
  SquareArrowOutUpRight,
  Heart,
  Newspaper,
  CalendarClock,
  SquareArrowDown,
  ScrollText,
  BookUser,
  HardDrive,
} from "lucide-react";
import { useAppNavigation } from "@/context/AppContext";
import { MenuItem } from "./MenuItem";
import { AuthButton } from "./AuthButton";
import ThemeToggle from "./ThemeToggle";
import AnimationToggle from "../animations/AnimationToggle";
import PlanBadge from "@/components/uikit/PlanBadge/PlanBadge";
import { SonnerError, SonnerSuccess } from "@/components/uikit/SonnerToast";
import { CONFIG } from "@/config";
import { useAuthStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { isAdminUser } from "@/utils/googleDrive";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";
import {
  hasAdminSession,
  verifyAdminSession,
} from "@/services/AdminAuthService";

const Sidebar = () => {
  const user = useAuthStore((state) => state.user);
  const clearAndlogout = useAuthStore((state) => state.clearAndlogout);
  const { t } = useTranslation("auth");

  const navigation = useAppNavigation();
  const { isSidebarOpen, setIsSidebarOpen } = navigation;

  const localId = getMyLocalId(user);
  const email =
    user?.email ||
    localStorage.getItem("email") ||
    sessionStorage.getItem("email") ||
    "";
  // Chỉ admin thật (email/localId whitelist) — user thường KHÔNG thấy menu Drive
  const isDriveAdmin =
    Boolean(user) &&
    isAdminUser(localId, { email, localId, uid: user?.uid || localId });
  const [isAdmin, setIsAdmin] = useState(isDriveAdmin || false);

  useEffect(() => {
    let active = true;
    if (isDriveAdmin) {
      setIsAdmin(true);
    }
    const checkAdmin = async () => {
      if (!user) {
        if (active) setIsAdmin(false);
        return;
      }
      if (isDriveAdmin) {
        if (active) setIsAdmin(true);
        return;
      }
      try {
        const verified = await verifyAdminSession();
        if (active) setIsAdmin(verified || isDriveAdmin);
      } catch {
        if (active) setIsAdmin(isDriveAdmin);
      }
    };
    checkAdmin();
    return () => {
      active = false;
    };
  }, [user, isDriveAdmin]);

  const drawerRef = useRef(null);

  const handleClose = useCallback(() => {
    setIsSidebarOpen(false);
  }, [setIsSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) return;

    const previousActiveElement = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      if (e.key === "Tab") {
        if (!drawerRef.current) return;
        const focusableElements = drawerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    if (drawerRef.current) {
      const focusableElements = drawerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        const closeBtn = drawerRef.current.querySelector('[aria-label="Close menu"]');
        if (closeBtn) {
          closeBtn.focus();
        } else {
          focusableElements[0].focus();
        }
      }
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        const trigger = document.getElementById("hamburger-menu-trigger");
        if (trigger) {
          trigger.focus();
        } else {
          previousActiveElement.focus();
        }
      }
    };
  }, [isSidebarOpen, handleClose]);

  const currentYear = new Date().getFullYear();
  const { startYear } = CONFIG.app;
  const handleLogout = async () => {
    const displayName =
      user?.displayName || t("sidebar.logout_default_user");
    try {
      setIsSidebarOpen(false);
      // await để isAuth=false trước khi chuyển trang (tránh bị đẩy lại /locket)
      await clearAndlogout();
      SonnerSuccess(
        t("sidebar.logout_success"),
        t("sidebar.logout_goodbye", { name: displayName }),
      );
      // Hard redirect → màn khám phá (trang chủ public); chắc chắn thoát app auth
      window.location.assign("/");
    } catch (error) {
      SonnerError("error", t("sidebar.logout_error"));
      console.error("❌ Lỗi khi đăng xuất:", error);
      // Vẫn cố về public
      try {
        await clearAndlogout();
      } catch {
        /* ignore */
      }
      window.location.assign("/login");
    }
  };

  // Menu chia theo nhóm — Google Drive CHỈ admin, ẩn hoàn toàn với user thường
  const userMenuSections = [
    ...(isDriveAdmin
      ? [
          {
            title: "⚡ Google Drive",
            items: [
              {
                to: "/admin/google-drive",
                icon: HardDrive,
                text: "Quản lý Drive (Admin)",
                badge: "Admin",
              },
            ],
          },
        ]
      : []),
    {
      title: "Huy Locket",
      items: [
        { to: "/home", icon: Home, text: t("sidebar.menu.home") },
        { to: "/about", icon: Info, text: "Huy Locket" },
        { to: "/newsfeed", icon: Newspaper, text: t("sidebar.menu.newsfeed"), badge: "New" },
        {
          to: "/download",
          icon: SquareArrowOutUpRight,
          text: t("sidebar.menu.download"),
        },
        { to: "/sponsors", icon: Heart, text: t("sidebar.menu.sponsors") },
      ],
    },
    {
      title: t("sidebar.sections.features"),
      badge: <PlanBadge />,
      items: [
        { to: "/postmoments", icon: Upload, text: t("sidebar.menu.post") },
        {
          to: "/locket",
          icon: Smartphone,
          text: t("sidebar.menu.locket_camera"),
          badge: "Beta",
        },
        { to: "/tools", icon: Wrench, text: t("sidebar.menu.tools") },
        {
          to: "/diary",
          icon: CalendarClock,
          text: t("sidebar.menu.diary"),
          badge: "New",
        },
        { to: "/friends", icon: BookUser, text: t("sidebar.menu.friends") },
        { to: "/pricing", icon: Rocket, text: t("sidebar.menu.pricing"), badge: "Hot" },
        { to: "/profile", icon: UserRound, text: t("sidebar.menu.profile") },
      ],
    },
    {
      title: t("sidebar.sections.partners"),
      items: [
        { to: "/collab/caption-kanade", icon: Palette, text: t("sidebar.menu.caption_kanade") },
        {
          to: "/collab/locket-upload",
          icon: SquareArrowDown,
          text: t("sidebar.menu.locket_upload"),
        },
      ],
    },
    {
      title: t("sidebar.sections.system"),
      items: [
        { to: "/incidents", icon: Bug, text: t("sidebar.menu.incidents") },
        { to: "/contact", icon: LifeBuoy, text: t("sidebar.menu.contact") },
        { to: "/terms", icon: ScrollText, text: t("sidebar.menu.terms") },
        { to: "/privacy", icon: ShieldCheck, text: t("sidebar.menu.privacy") },
        { to: "/settings", icon: Settings, text: t("sidebar.menu.settings") },
      ],
    },
  ];

  const guestMenuSections = [
    {
      title: t("sidebar.sections.locket_dio"),
      items: [
        { to: "/", icon: Home, text: t("sidebar.menu.home") },
        { to: "/about", icon: Info, text: t("sidebar.menu.about") },
        { to: "/about-huy", icon: UserCircle, text: "Về Huy" },
        { to: "/newsfeed", icon: Newspaper, text: t("sidebar.menu.newsfeed"), badge: "New" },
        {
          to: "/download",
          icon: SquareArrowOutUpRight,
          text: t("sidebar.menu.download"),
        },
      ],
    },
    {
      title: t("sidebar.sections.resources"),
      items: [
        { to: "/pricing", icon: Rocket, text: t("sidebar.menu.pricing"), badge: "New" },
        { to: "/sponsors", icon: Heart, text: t("sidebar.menu.sponsors") },
        { to: "/timeline", icon: Clock, text: t("sidebar.menu.timeline") },
        { to: "/docs", icon: BookText, text: t("sidebar.menu.docs") },
      ],
    },
    {
      title: t("sidebar.sections.partners"),
      items: [
        { to: "/collab/caption-kanade", icon: Palette, text: t("sidebar.menu.caption_kanade") },
        {
          to: "/collab/locket-upload",
          icon: SquareArrowDown,
          text: t("sidebar.menu.locket_upload"),
        },
      ],
    },
    {
      title: t("sidebar.sections.system"),
      items: [
        { to: "/incidents", icon: Bug, text: t("sidebar.menu.incidents") },
        { to: "/contact", icon: LifeBuoy, text: t("sidebar.menu.contact") },
        { to: "/terms", icon: ScrollText, text: t("sidebar.menu.terms") },
        { to: "/privacy", icon: ShieldCheck, text: t("sidebar.menu.privacy") },
        { to: "/settings", icon: Settings, text: t("sidebar.menu.settings") },
      ],
    },
  ];

  const menuSections = [
    ...(isAdmin || isDriveAdmin
      ? [{
          title: "Quản trị Huy Locket",
          items: [{
            to: "/admin/users",
            icon: UserRound,
            text: "Quản lý người dùng",
            badge: "Admin",
          }],
        }]
      : []),
    ...(user ? userMenuSections : guestMenuSections),
  ];

  const prefersReducedMotion = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  const scrimStyle = {
    transitionProperty: "opacity",
    transitionDuration: prefersReducedMotion ? "0ms" : "180ms",
  };

  const drawerStyle = {
    transitionProperty: "transform",
    transitionDuration: prefersReducedMotion ? "0ms" : (isSidebarOpen ? "220ms" : "180ms"),
    transitionTimingFunction: isSidebarOpen ? "cubic-bezier(0, 0, 0.2, 1)" : "cubic-bezier(0.4, 0, 1, 1)",
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed h-screen z-60 inset-0 bg-base-100/10 ${
          isSidebarOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        style={scrimStyle}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Navigation Drawer */}
      <nav
        id="huy-locket-nav-drawer"
        ref={drawerRef}
        aria-label="Main Navigation"
        role="dialog"
        aria-modal="true"
        className={`fixed z-60 top-0 right-0 h-full w-full max-w-[320px] sm:max-w-[360px] shadow-xl bg-base-100 flex flex-col ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={drawerStyle}
      >
        {/* Header */}
        <div className="flex justify-between items-center py-3 px-2 border-b border-base-300 flex-shrink-0">
          <Link to="/" className="flex items-center gap-1" onClick={handleClose}>
            <span className="text-lg pl-2 font-semibold gradient-text select-none">
              {t("sidebar.menu_title")}
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <AnimationToggle title="Bật/tắt hiệu ứng" />
            <ThemeToggle />
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={handleClose}
            className="p-2 rounded-md transition cursor-pointer btn btn-ghost btn-circle"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto">
          <ul className="menu text-base-content w-full py-2 text-md font-semibold">
            {menuSections.map((section) => (
              <li key={section.title}>
                <h2 className="menu-title flex items-center justify-between">
                  <span>{section.title}</span>
                  {section.badge && <div>{section.badge}</div>}
                </h2>
                <ul>
                    {section.items.map((item) => (
                      <MenuItem
                        key={item.to}
                        to={item.to}
                        icon={item.icon}
                        badge={item.badge}
                        onClick={handleClose}
                      >
                        {item.text}
                      </MenuItem>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        {/* Auth Button */}
        <AuthButton
          user={user}
          onLogout={handleLogout}
          onClose={handleClose}
        />

        <div>
          <p className="text-center text-xs pb-2 text-base-content/70">
            © {startYear}
            {currentYear > startYear && `–${currentYear}`}{" "}
            <span className="font-semibold font-lovehouse">Huy</span>.{" "}
            {t("sidebar.copyright")}
          </p>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
