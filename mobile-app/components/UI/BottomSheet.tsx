import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, View } from 'react-native';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function nearest(value: number, candidates: number[]) {
  let best = candidates[0];
  let bestD = Math.abs(value - best);
  for (const c of candidates) {
    const d = Math.abs(value - c);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

export function BottomSheet(props: {
  snapPoints: number[]; // visible heights in px (e.g., [120, 360, 620])
  initialSnapIndex?: number;
  snapToIndex?: number; // optional controlled snap
  children: React.ReactNode;
  onSnapIndexChange?: (idx: number) => void;
  backdrop?: boolean;
  backgroundColor?: string;
  contentStyle?: any;
  bottomOffset?: number; // push sheet up (e.g. tab-bar height)
}) {
  const { height: screenHRaw } = Dimensions.get('window');
  const bottomOffset = Math.max(0, Number(props.bottomOffset || 0));
  const screenH = Math.max(1, screenHRaw - bottomOffset);
  const snapHeights = useMemo(() => [...props.snapPoints].sort((a, b) => a - b), [props.snapPoints]);
  const minH = snapHeights[0];
  const maxH = snapHeights[snapHeights.length - 1];

  // translateY: 0 means fully expanded (top of sheet at y=0); but our sheet is bottom-anchored.
  // We map visible height -> translateY = screenH - visibleHeight.
  const snapYs = useMemo(() => snapHeights.map((h) => clamp(screenH - h, 0, screenH)), [screenH, snapHeights]);
  const yMin = useMemo(() => Math.min(...snapYs), [snapYs]);
  const yMax = useMemo(() => Math.max(...snapYs), [snapYs]);
  const initialIdx = clamp(props.initialSnapIndex ?? 1, 0, snapYs.length - 1);

  const translateY = useRef(new Animated.Value(snapYs[initialIdx])).current;
  const startY = useRef(snapYs[initialIdx]);
  const lastSnapIdx = useRef(initialIdx);

  const snapTo = (idx: number, opts?: { animated?: boolean }) => {
    const i = clamp(idx, 0, snapYs.length - 1);
    const target = snapYs[i];
    lastSnapIdx.current = i;
    if (opts?.animated === false) {
      translateY.setValue(target);
      props.onSnapIndexChange?.(i);
      return;
    }
    Animated.spring(translateY, {
      toValue: target,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
      mass: 0.9,
    }).start();
    props.onSnapIndexChange?.(i);
  };

  // Controlled snapping (optional)
  useEffect(() => {
    if (typeof props.snapToIndex !== 'number') return;
    if (props.snapToIndex === lastSnapIdx.current) return;
    snapTo(props.snapToIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.snapToIndex, snapYs.join('|')]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          translateY.stopAnimation((v) => {
            startY.current = v as number;
          });
        },
        onPanResponderMove: (_evt, g) => {
          const next = clamp(startY.current + g.dy, yMin, yMax);
          translateY.setValue(next);
        },
        onPanResponderRelease: (_evt, g) => {
          const projected = clamp(startY.current + g.dy + g.vy * 120, yMin, yMax);
          const target = nearest(projected, snapYs);
          const idx = snapYs.indexOf(target);
          snapTo(idx);
        },
      }),
    [props, snapYs, translateY, yMax, yMin],
  );

  const backdropOpacity = props.backdrop
    ? translateY.interpolate({
        // When expanded (yMin), backdrop is stronger. When collapsed/hidden (yMax), backdrop is 0.
        inputRange: [yMax, yMin],
        outputRange: [0, 0.35],
        extrapolate: 'clamp',
      })
    : null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {props.backdrop && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity as any }]} />
      )}

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: props.backgroundColor ?? styles.sheet.backgroundColor },
          {
            height: screenH,
            bottom: bottomOffset,
            transform: [{ translateY }],
          },
        ]}
      >
        <View {...pan.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
        <View style={[styles.content, props.contentStyle]}>{props.children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b1220',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  handleArea: { paddingTop: 10, paddingBottom: 10, alignItems: 'center' },
  handle: { width: 44, height: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  content: { flex: 1, paddingHorizontal: 14, paddingBottom: 18 },
});


