import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type EntryLayoutProps = {
  step: number;
  totalSteps: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
};

export default function EntryLayout({
  step,
  totalSteps,
  eyebrow,
  title,
  subtitle,
  icon,
  children,
}: EntryLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary/10 to-transparent" />

      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Progress */}
          <div className="mb-6 flex items-center justify-between">
            <div className="text-xs font-semibold text-muted-foreground">
              Étape {step} / {totalSteps}
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 w-7 rounded-full border border-border bg-secondary",
                    i < step ? "bg-primary/70 border-primary/40" : "opacity-60",
                  )}
                />
              ))}
            </div>
          </div>

          {/* Header */}
          <div className="mb-6">
            {icon && (
              <div className="mb-5 flex items-center justify-center">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-md" />
                  <div className="relative">{icon}</div>
                </div>
              </div>
            )}

            {eyebrow && (
              <div className="text-center text-xs font-bold uppercase tracking-wider text-primary/90">
                {eyebrow}
              </div>
            )}

            <h1 className="mt-2 text-center text-3xl font-display font-extrabold leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

          {/* Body */}
          {children}
        </motion.div>
      </div>
    </div>
  );
}


