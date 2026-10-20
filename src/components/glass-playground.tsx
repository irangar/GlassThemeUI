"use client";

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { GRADIENTS, gradientBackground, imageValidationError, type Gradient } from "@/lib/backgrounds";
import { GlassFilter, GlassSurface } from "./glass-surface";
import { GradientEditor } from "./gradient-editor";
import { CameraIcon, CloseIcon, GradientIcon, ImageIcon, LayersIcon, MoonIcon } from "./icons";

export function GlassPlayground({ children }: { children: ReactNode }) {
  const [gradient, setGradient] = useState<Gradient>(GRADIENTS[0]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [clearGlass, setClearGlass] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const imageRequest = useRef(0);
  const activeUrl = useRef<string | null>(null);
  const pendingUrls = useRef(new Set<string>());
  const gradientButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const pending = pendingUrls.current;
    return () => {
      imageRequest.current += 1;
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
      pending.forEach((url) => URL.revokeObjectURL(url));
      pending.clear();
    };
  }, []);

  function releaseImage() {
    imageRequest.current += 1;
    pendingUrls.current.forEach((url) => URL.revokeObjectURL(url));
    pendingUrls.current.clear();
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = null;
    setImageUrl(null);
    setImageName("");
    setLoadingImage(false);
  }

  function changeGradient(value: Gradient) {
    releaseImage();
    setGradient(value);
    setError("");
  }

  function openGradientEditor() {
    changeGradient(gradient);
    setEditorOpen(true);
  }

  function closeGradientEditor() {
    setEditorOpen(false);
    gradientButton.current?.focus();
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const request = ++imageRequest.current;
    const validation = imageValidationError(file);
    setError(validation ?? "");
    setLoadingImage(false);
    if (validation) return;

    const url = URL.createObjectURL(file);
    pendingUrls.current.add(url);
    setLoadingImage(true);
    try {
      // Decode before swapping so invalid files never replace a working background.
      const image = new Image();
      image.src = url;
      await image.decode();
      if (request !== imageRequest.current) return;
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
      activeUrl.current = url;
      pendingUrls.current.delete(url);
      setImageUrl(url);
      setImageName(file.name);
    } catch {
      if (request === imageRequest.current) {
        setError("This image could not be opened. Try another JPG, PNG, WebP, AVIF, or GIF.");
      }
    } finally {
      if (pendingUrls.current.delete(url)) URL.revokeObjectURL(url);
      if (request === imageRequest.current) setLoadingImage(false);
    }
  }

  const sceneStyle = {
    "--scene-background": imageUrl ? `url("${imageUrl}")` : gradientBackground(gradient),
  } as CSSProperties;

  return (
    <div
      className={`playground${focused ? " is-focused" : ""}${clearGlass ? " is-clear" : ""}`}
      style={sceneStyle}
    >
      <div className="scene-background" aria-hidden="true" />
      <GlassFilter />
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Liquid Glass home">
          <span className="brand-symbol" aria-hidden="true"><span /><span /></span>
          <span>liquid<span className="wordmark-light">glass</span><span className="brand-period">.</span></span>
        </Link>
        <div className="background-tools" role="group" aria-label="Page background">
          <button className="flat-button" type="button" onClick={() => fileInput.current?.click()} disabled={loadingImage}>
            <ImageIcon />
            <span>{loadingImage ? "Opening…" : "Image"}</span>
          </button>
          <button
            ref={gradientButton}
            className="flat-button"
            type="button"
            onClick={openGradientEditor}
            aria-haspopup="dialog"
            aria-expanded={editorOpen}
          >
            <GradientIcon />
            <span>Gradient</span>
          </button>
        </div>
        <input
          ref={fileInput}
          className="file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          aria-label="Choose a background image"
          onChange={selectImage}
          tabIndex={-1}
        />
      </header>

      <main className="hero">
        <div className="hero-copy">{children}</div>
        <div className="glass-controls" aria-label="Interactive glass controls">
          <GlassSurface
            className="focus-control"
            aria-label="Focus mode"
            aria-pressed={focused}
            onClick={() => setFocused((value) => !value)}
            title="Toggle focus mode"
          >
            <span className="moon-disc"><MoonIcon /></span>
            <span className="focus-label">Focus</span>
            <span className="focus-indicator" aria-hidden="true" />
          </GlassSurface>
          <div className="round-controls">
            <GlassSurface
              className="round-control camera-control"
              aria-label="Choose a background image"
              onClick={() => fileInput.current?.click()}
              disabled={loadingImage}
              title="Choose a background image"
            >
              <CameraIcon />
            </GlassSurface>
            <GlassSurface
              className="round-control layers-control"
              aria-label="Clear glass"
              aria-pressed={clearGlass}
              onClick={() => setClearGlass((value) => !value)}
              title="Toggle clear and frosted glass"
            >
              <LayersIcon />
            </GlassSurface>
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <span className="footer-description">A study in light. <span>Made to be yours.</span></span>
        <span className="scene-label" title={imageUrl ? imageName : gradient.name}>
          <span className="status-dot" />
          {imageUrl ? "Your image" : gradient.name}
          <span className="footer-separator">/</span>
          {clearGlass ? "Clear glass" : "Liquid glass"}
        </span>
      </footer>
      <span className="sr-only" role="status" aria-live="polite">
        {loadingImage ? "Opening image." : imageUrl ? `Background: ${imageName}.` : `Background: ${gradient.name} gradient.`}
        {focused ? " Focus mode on." : ""}
        {clearGlass ? " Clear glass on." : ""}
      </span>
      {error && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button className="icon-button" type="button" onClick={() => setError("")} aria-label="Dismiss error"><CloseIcon /></button>
        </div>
      )}
      {editorOpen && <GradientEditor gradient={gradient} onChange={changeGradient} onClose={closeGradientEditor} />}
    </div>
  );
}
