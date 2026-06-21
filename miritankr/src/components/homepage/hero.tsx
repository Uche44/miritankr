"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "../../hooks/use-auth-session";

const Hero: React.FC = () => {
    const router = useRouter();
    const { isLoggedIn, user } = useAuthSession();

    const handleOrderClick = () => {
        if (isLoggedIn && user) {
            if (user.role === "ADMIN") {
                router.push("/dashboard/admin");
            } else if (user.role === "FACILITY") {
                router.push("/dashboard/facility");
            } else if (user.role === "DRIVER") {
                router.push("/dashboard/driver");
            } else {
                router.push("/dashboard/customer");
            }
        } else {
            router.push("/register");
        }
    };

    return (
        <section className="hero-gradient relative px-2 w-full h-screen flex flex-col justify-center items-center  ">
            <img src="/images/tanker.png" alt="" className="absolute top-[17vh] hidden md:block w-[20%] left-[15%] z-10 h-[20vh]" />
            <h1 className="text-[34px] md:text-8xl text-white font-bold text-center">Stop Calling Tanker Drivers <br /> Start Ordering Water</h1>
            <p className="text-white text-[15px] md:text-2xl mt-4 text-center">MiriTankr is Enugu's premier water supply verification and logistics platform. <br />
                Get safe, clean water delivered by verified tankers with full provenance tracking and regulated fair pricing.</p>
            <button
                onClick={handleOrderClick}
                className="py-2 bg-white rounded-md md:py-3 mt-4 md:mt-8 px-4 text-[15px] md:text-xl z-999 cursor-pointer text-brand hover:brightness-95"
            >
                Place Order
            </button>

            <img src="/images/water.png" alt="" className="absolute bottom-0 hidden md:block w-full right-0 z-10 h-[70vh]" />

        </section>
    );
};

export default Hero;
