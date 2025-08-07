"use client";

import React from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export const Mascot = ({
    srcFiles,
    className
}: {
    srcFiles?: string;
    className?: string;
}) => {
    return (
        <DotLottieReact
            src={srcFiles}
            loop
            autoplay
            className={className}
        />
    );
};
