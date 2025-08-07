"use client";

import React, { ReactNode, useCallback, useLayoutEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import ResizeObserver from 'resize-observer-polyfill';

// =======================================================
// constants
// =======================================================
const MAX_STYLE: React.CSSProperties = { maxWidth: '100%' };
const PARENT_STYLE: React.CSSProperties = { position: 'relative', ...MAX_STYLE };
const PLACEHOLDER_STYLE: React.CSSProperties = { ...MAX_STYLE };
const CHILD_STYLE_BASE: React.CSSProperties = {
    width: '100%',
    position: 'fixed',
    zIndex: 4000,
    ...MAX_STYLE,
};
const SCROLLING_DOWN_CLASS = 'scrolling-down';
const SCROLLING_UP_CLASS = 'scrolling-up';


// =======================================================
// PeekElement
// =======================================================

interface PeekApi {
    show: () => void;
    hide: () => void;
    toggle: () => void;
    isVisible: () => boolean;
}

type PeekBehavior = 'slide' | 'snap';
type PeekPosition = 'top' | 'bottom';

interface PeekConfig {
    behavior?: PeekBehavior;
    position?: PeekPosition;
    revealDuration?: number;
    scrollThreshold?: number;
    hideOnScrollUp?: boolean;
    sizeListener?: (rect: DOMRect) => void;
    parentProps?: React.HTMLAttributes<HTMLDivElement>;
    childProps?: React.HTMLAttributes<HTMLDivElement>;
    placeHolderProps?: React.HTMLAttributes<HTMLDivElement>;
    className?: string;
}

interface PeekElementProps {
    config?: PeekConfig;
    // MODIFICATION: Add a ref for the scrollable container
    scrollableContainerRef?: React.RefObject<HTMLElement | null>;
    children: ReactNode | ((api: PeekApi) => ReactNode);
}

export const PeekElement = forwardRef<PeekApi | undefined, PeekElementProps>((props, ref) => {
    const { config = {}, scrollableContainerRef } = props; // MODIFICATION: Destructure the new prop
    const {
        behavior = 'slide',
        position = 'top',
        revealDuration = 250,
        scrollThreshold = 15,
        hideOnScrollUp = false,
        sizeListener = () => {},
        parentProps = {},
        childProps = {},
        placeHolderProps = {},
        className = "",
    } = config;

    const placeHolderRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const childRef = useRef<HTMLDivElement>(null);

    const childHeight = useRef<number>(0);
    const transformValue = useRef<number>(0);

    const lastScrollPosition = useRef<number>(0);
    const scrollAcc = useRef<number>(0);

    const getTransformStyle = () => `translateY(${transformValue.current}px)`;

    const handleRepositionAction = useCallback(() => {
        if (!childRef.current || !containerRef.current || !placeHolderRef.current) return;

        const child = childRef.current;
        // MODIFICATION: Use scrollable container's scrollTop if available, otherwise fallback to window.scrollY
        const scrollTarget = scrollableContainerRef?.current ?? window;
        const scrollY = 'scrollY' in scrollTarget ? scrollTarget.scrollY : scrollTarget.scrollTop;

        const scrollDelta = scrollY - lastScrollPosition.current;

        if (behavior === 'slide') {
            const scrollingUp = scrollDelta < 0;
            const scrollingDown = scrollDelta > 0;
            let newTransform = transformValue.current;

            if (hideOnScrollUp) {
                if (scrollingUp) newTransform -= Math.abs(scrollDelta);
                if (scrollingDown) newTransform += Math.abs(scrollDelta);
            } else {
                if (scrollingUp) newTransform += Math.abs(scrollDelta);
                if (scrollingDown) newTransform -= Math.abs(scrollDelta);
            }

            const maxTransform = position === 'top' ? 0 : childHeight.current;
            const minTransform = position === 'top' ? -childHeight.current : 0;
            transformValue.current = Math.max(minTransform, Math.min(maxTransform, newTransform));

            if (scrollingUp) {
                child.classList.add(SCROLLING_UP_CLASS);
                child.classList.remove(SCROLLING_DOWN_CLASS);
            } else if (scrollingDown) {
                child.classList.add(SCROLLING_DOWN_CLASS);
                child.classList.remove(SCROLLING_UP_CLASS);
            }

        } else { // behavior === 'snap'
            scrollAcc.current += Math.abs(scrollDelta);
            if (scrollAcc.current > scrollThreshold) {
                const shouldHide = (scrollDelta > 0 && !hideOnScrollUp) || (scrollDelta < 0 && hideOnScrollUp);
                if (shouldHide) {
                    transformValue.current = position === 'top' ? -childHeight.current : childHeight.current;
                } else {
                    transformValue.current = 0;
                }
                scrollAcc.current = 0;
            }
        }

        if (scrollY < 20) {
            transformValue.current = 0;
        }

        child.style.transform = getTransformStyle();
        lastScrollPosition.current = scrollY;

        const childRect = child.getBoundingClientRect();
        const parentRect = containerRef.current.getBoundingClientRect();
        if (childHeight.current !== childRect.height || child.style.width !== `${parentRect.width}px`) {
            childHeight.current = childRect.height;
            child.style.width = `${parentRect.width}px`;
            placeHolderRef.current.style.height = `${childRect.height}px`;
            placeHolderRef.current.style.width = `${parentRect.width}px`;
            sizeListener(childRect);
        }
    }, [behavior, position, scrollThreshold, hideOnScrollUp, sizeListener, scrollableContainerRef]);

    useLayoutEffect(() => {
        if (!childRef.current) return;

        // MODIFICATION: Determine the scroll target
        const scrollTarget = scrollableContainerRef?.current ?? window;

        const observer = new ResizeObserver(() => {
            handleRepositionAction();
        });
        observer.observe(childRef.current);

        lastScrollPosition.current = 'scrollY' in scrollTarget ? scrollTarget.scrollY : scrollTarget.scrollTop;
        handleRepositionAction();
        // MODIFICATION: Add event listeners to the correct target
        scrollTarget.addEventListener('scroll', handleRepositionAction, { passive: true });
        window.addEventListener('resize', handleRepositionAction); // Resize should still be on window

        return () => {
            observer.disconnect();
            scrollTarget.removeEventListener('scroll', handleRepositionAction);
            window.removeEventListener('resize', handleRepositionAction);
        };
    }, [handleRepositionAction, scrollableContainerRef]);

    const animateTo = (target: number) => {
        const child = childRef?.current;
        if (child) {
            child.style.transition = `transform ${revealDuration}ms ease-out`;
            transformValue.current = target;
            child.style.transform = getTransformStyle();
            setTimeout(() => { if (child) child.style.transition = ''; }, revealDuration);
        }
    };

    const isVisible = () => transformValue.current === 0;

    const api: PeekApi = {
        show: () => animateTo(0),
        hide: () => animateTo(position === 'top' ? -childHeight.current : childHeight.current),
        toggle: () => isVisible() ? api.hide() : api.show(),
        isVisible: isVisible,
    };

    useImperativeHandle(ref, () => api, []);

    const finalParentStyle: React.CSSProperties = { ...PARENT_STYLE, ...parentProps.style };
    const finalChildStyle: React.CSSProperties = {
        ...CHILD_STYLE_BASE,
        ...(position === 'top' ? { top: 0 } : { bottom: 0, top: 'auto' }),
        ...childProps.style,
    };
    const finalPlaceHolderStyle: React.CSSProperties = { ...PLACEHOLDER_STYLE, ...placeHolderProps.style };

    return (
        <div ref={containerRef} {...parentProps} style={finalParentStyle} className={className}>
            <div ref={childRef} {...childProps} style={finalChildStyle}>
                {typeof props.children === 'function' ? props.children(api) : props.children}
            </div>
            <div ref={placeHolderRef} {...placeHolderProps} style={finalPlaceHolderStyle} />
        </div>
    );
});

PeekElement.displayName = 'PeekElement';

