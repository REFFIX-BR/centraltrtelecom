import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
  type ViewToken,
} from 'react-native';

import { type PromoBanner } from '@/src/services/banners';
import { colors, radius, shadows, spacing } from '@/src/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const CARD_HEIGHT = 168;
const AUTO_MS = 5000;

type Props = {
  banners: PromoBanner[];
};

export function PromoCarousel({ banners }: Props) {
  const router = useRouter();
  const listRef = useRef<FlatList<PromoBanner>>(null);
  const indexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const items = useMemo(
    () => banners.filter((banner) => !!banner.imageUrl?.trim()),
    [banners]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const next = viewableItems[0]?.index;
      if (typeof next === 'number') {
        indexRef.current = next;
        setActiveIndex(next);
      }
    }
  ).current;

  const goTo = useCallback(
    (index: number, animated = true) => {
      if (!items.length) return;
      const safeIndex = ((index % items.length) + items.length) % items.length;
      listRef.current?.scrollToIndex({ index: safeIndex, animated });
      indexRef.current = safeIndex;
      setActiveIndex(safeIndex);
    },
    [items.length]
  );

  useEffect(() => {
    indexRef.current = 0;
    setActiveIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1 || paused) return;

    const timer = setInterval(() => {
      goTo(indexRef.current + 1);
    }, AUTO_MS);

    return () => clearInterval(timer);
  }, [items.length, paused, goTo]);

  useEffect(() => {
    const urls = items
      .map((item) => item.imageUrl?.trim())
      .filter((url): url is string => !!url);
    if (!urls.length) return;
    void Image.prefetch(urls, { cachePolicy: 'memory-disk' });
  }, [items]);

  if (items.length === 0) return null;

  async function openBanner(banner: PromoBanner) {
    const link = banner.linkUrl.trim();
    if (!link) return;

    if (/^https?:\/\//i.test(link)) {
      await WebBrowser.openBrowserAsync(link);
      return;
    }

    const route = link.startsWith('/') ? link : `/${link}`;
    router.push(route as never);
  }

  function onScrollBeginDrag() {
    setPaused(true);
  }

  function onMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / PAGE_WIDTH);
    if (Number.isFinite(next)) {
      indexRef.current = next;
      setActiveIndex(next);
    }
    setPaused(false);
  }

  return (
    <View style={styles.section}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={PAGE_WIDTH}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces={false}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        getItemLayout={(_, index) => ({
          length: PAGE_WIDTH,
          offset: PAGE_WIDTH * index,
          index,
        })}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={({ index }) => {
          requestAnimationFrame(() => goTo(index, false));
        }}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item }) => {
          const clickable = !!item.linkUrl?.trim();

          return (
            <Pressable
              accessibilityRole={clickable ? 'link' : 'image'}
              accessibilityLabel={item.title || 'Propaganda'}
              disabled={!clickable}
              onPress={() => openBanner(item)}
              style={({ pressed }) => [
                styles.cardWrap,
                pressed && clickable && styles.cardPressed,
              ]}
            >
              <View style={styles.imageCard}>
                <Image
                  source={item.imageUrl}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={item.imageUrl}
                  transition={160}
                />
              </View>
            </Pressable>
          );
        }}
      />

      {items.length > 1 ? (
        <View style={styles.dots}>
          {items.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Ir para propaganda ${index + 1}`}
              onPress={() => goTo(index)}
              hitSlop={8}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  list: {
    overflow: 'visible',
  },
  listContent: {
    alignItems: 'stretch',
  },
  cardWrap: {
    width: PAGE_WIDTH,
    height: CARD_HEIGHT,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  imageCard: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.primaryDark,
    ...shadows.soft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.accent,
  },
});
