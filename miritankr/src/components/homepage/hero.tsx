"use client";

import React from "react";

const Hero: React.FC = () => {
    return (
        <section className="hero-gradient relative px-2 w-full h-screen flex flex-col justify-center items-center  ">
            <h1 className="text-[34px] md:text-8xl text-white font-bold text-center">Stop Calling Tanker Drivers <br /> Start Ordering Water</h1>
            <p className="text-white text-[15px] md:text-2xl mt-4 text-center">Find nearby water suppliers, compare prices, and track deliveries in real time.</p>
            <button className="py-2 bg-white rounded-md md:py-3 mt-4 md:mt-8 px-4 text-[15px] md:text-xl cursor-pointer text-brand hover:brightness-95">Place Order</button>

            <img src="/images/water.png" alt="" className="absolute bottom-0 hidden md:block w-full right-0 z-10 h-[70vh]" />

        </section>
    );
};

export default Hero;
