import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { type CompetitionColorSet } from '@/constants/competition';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { CollaborationChart } from '@/components/CollaborationChart';
import { type CollaborationChartSeries } from '@/lib/collaborationChartData';

interface CollaborationChartCarouselProps {
  seriesList: CollaborationChartSeries[];
  colorSet: CompetitionColorSet;
}

export function CollaborationChartCarousel({
  seriesList,
  colorSet,
}: CollaborationChartCarouselProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  const pageWidth = windowWidth;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginBottom: Spacing.md,
        },
        dots: {
          flexDirection: 'row',
          justifyContent: 'center',
          gap: Spacing.sm,
          marginTop: Spacing.sm,
          marginBottom: Spacing.md,
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.muted,
        },
        dotActive: {
          backgroundColor: colorSet[500],
        },
      }),
    [colors, colorSet],
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / pageWidth);
    if (index !== activeIndex && index >= 0 && index < seriesList.length) {
      setActiveIndex(index);
    }
  };

  if (seriesList.length === 0) {
    return null;
  }

  if (seriesList.length === 1) {
    return (
      <View style={styles.container}>
        <CollaborationChart series={seriesList[0]} colorSet={colorSet} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {seriesList.map((series) => (
          <View key={series.periodType} style={{ width: pageWidth }}>
            <CollaborationChart series={series} colorSet={colorSet} />
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {seriesList.map((series, index) => (
          <View
            key={series.periodType}
            style={[styles.dot, index === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}
