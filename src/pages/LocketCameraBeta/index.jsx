import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useAppNavigation } from "@/context/AppContext";
import { useTheme } from "@/hooks/useTheme";
import MainHomeScreen from "./MainHomeScreen";
import { MusicPlayer } from "./Widgets/MusicPlayer";
import { useOverlayEditorStore } from "@/stores/PostStores/useOverlayEditorStore";
import { usePostStore } from "@/stores/PostStores/usePostStore";
import { useUIStore } from "@/stores/SettingStores/useUIStore";
import GlobalReactionEffect from "./Widgets/GlobalReactionEffect";
import { getPerfProfile } from "@/utils/device/perfProfile";

const BgHuyLocket = lazy(() => import("@/components/Effects/BgLocketDio"));

const LeftHomeScreen = lazy(() => import("./LeftHomeScreen"));
const RightHomeScreen = lazy(() => import("./RightHomeScreen"));

const FriendsContainer = lazy(() => import("../../features/FriendsContainer"));
const ScreenCustomeStudio = lazy(() => import("@/features/CustomeStudio"));
const CropImageStudio = lazy(() => import("@/features/EditorStudio/CropImageStudio"));
const CropVideoStudio = lazy(() => import("@/features/EditorStudio/CropVideoStudio"));
const OptionMoment = lazy(() => import("@/features/OptionMoment"));
const WelcomeModal = lazy(() => import("./Widgets/WelcomeModal"));

function idleSchedule(fn, { timeout = 2500, delay = 400 } = {}) {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(() => fn(), { timeout });
    return () => cancelIdleCallback(id);
  }
  const t = setTimeout(fn, delay);
  return () => clearTimeout(t);
}

export default function LocketCameraBeta() {
  // Navigation only — do NOT subscribe to camera (zoom must not re-render this shell)
  const {
    isHomeOpen,
    isProfileOpen,
    setIsHomeOpen,
    setIsProfileOpen,
    isOptionModalOpen,
    setOptionModalOpen,
    isFriendsTabOpen,
    isFilterOpen,
  } = useAppNavigation();
  const { perfMode } = useTheme();

  // Local canvas for legacy capture helpers (CameraButton uses its own)
  const canvasRef = useRef(null);

  const overlayData = useOverlayEditorStore((s) => s.overlayData);
  const background = useUIStore((s) => s.background);
  const imageToCrop = usePostStore((s) => s.imageToCrop);
  const videoToCrop = usePostStore((s) => s.videoToCrop);

  // Mount side panels only after first open (keep mounted afterward for swipe state)
  const [leftReady, setLeftReady] = useState(false);
  const [rightReady, setRightReady] = useState(false);
  const [friendsReady, setFriendsReady] = useState(false);
  const [customReady, setCustomReady] = useState(false);
  const [optionReady, setOptionReady] = useState(false);
  const [welcomeReady, setWelcomeReady] = useState(false);

  useEffect(() => {
    if (isProfileOpen) setLeftReady(true);
  }, [isProfileOpen]);

  useEffect(() => {
    if (isHomeOpen) setRightReady(true);
  }, [isHomeOpen]);

  useEffect(() => {
    if (isFriendsTabOpen) setFriendsReady(true);
  }, [isFriendsTabOpen]);

  useEffect(() => {
    if (isFilterOpen) setCustomReady(true);
  }, [isFilterOpen]);

  useEffect(() => {
    if (isOptionModalOpen) setOptionReady(true);
  }, [isOptionModalOpen]);

  useEffect(
    () =>
      idleSchedule(() => setWelcomeReady(true), {
        timeout: 2200,
        delay: 900,
      }),
    [],
  );

  // Preload heavy side chunks when idle — skip on low-end / save-data / manual lite.
  useEffect(() => {
    const perf = getPerfProfile();
    if (perfMode === "lite" || perf.isLowEnd || perf.saveData) return undefined;

    return idleSchedule(
      () => {
        import("./LeftHomeScreen");
        import("./RightHomeScreen");
        import("../../features/FriendsContainer");
        import("@/features/CustomeStudio");
      },
      { timeout: 5000, delay: 1200 },
    );
  }, [perfMode]);

  return (
    <>
      <Suspense fallback={null}>
        <BgHuyLocket bgSrc={background?.url} />
        <GlobalReactionEffect />
      </Suspense>

      <MainHomeScreen />

      {/* Page Views — mount once opened (or preloaded after idle) */}
      <Suspense fallback={null}>
        {leftReady ? (
          <LeftHomeScreen setIsProfileOpen={setIsProfileOpen} />
        ) : null}
        {rightReady ? <RightHomeScreen setIsHomeOpen={setIsHomeOpen} /> : null}
      </Suspense>

      {/* Modal Views — lazy chunks; preload on idle above */}
      <Suspense fallback={null}>
        {friendsReady ? <FriendsContainer /> : null}
        {imageToCrop ? <CropImageStudio /> : null}
        {videoToCrop ? <CropVideoStudio /> : null}
        {customReady ? <ScreenCustomeStudio /> : null}
        {optionReady ? (
          <OptionMoment
            setOptionModalOpen={setOptionModalOpen}
            isOptionModalOpen={isOptionModalOpen}
          />
        ) : null}
        {welcomeReady ? <WelcomeModal /> : null}
      </Suspense>

      <canvas ref={canvasRef} className="hidden" />
      {overlayData.type === "music" && (
        <MusicPlayer music={overlayData.payload} />
      )}
      <span className="fixed pointer-events-none z-60 bottom-3 right-4 text-xs text-gray-400 select-none">
        © Huy Locket
      </span>
    </>
  );
}
