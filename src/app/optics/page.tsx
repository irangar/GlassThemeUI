import type { Metadata } from "next";
import { OpticalLab } from "@/components/optical-lab";
import "./optical-lab.css";

export const metadata: Metadata = {
  title: "Optical Lab | Liquid Glass UI",
  description: "Drag liquid-filled glass lenses and inspect refraction, reflection, caustics, and absorption.",
};

export default function OpticsPage() {
  return <OpticalLab />;
}
