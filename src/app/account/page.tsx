"use client";
import { Auth } from "@/components/auth";
export default function AccountPage() { return <main className="account-page"><Auth passwordOnly close={() => window.location.assign("/")} /></main>; }
