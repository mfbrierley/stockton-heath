import { globalStyles } from "@/app/styles/globalStyles";
import { theme } from "@/app/styles/theme";
import BlackBin from "@/assets/images/bins/black-bin.svg";
import BlueBin from "@/assets/images/bins/blue-bin.svg";
import FoodBin from "@/assets/images/bins/foodwaste-bin.svg";
import GreenBin from "@/assets/images/bins/green-bin.svg";
import { getNextCollectionDate } from "@/utils/dateUtils";
import _ from "lodash";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SvgProps } from "react-native-svg";

const BIN_ICONS: Record<string, React.FC<SvgProps>> = {
  "blue bin": BlueBin,
  "green bin": GreenBin,
  "black bin": BlackBin,
  "food waste bin": FoodBin,
};

interface WasteCollectionProps {
  binCollectionsData: any;
  isLoading: boolean;
  isAddressSet: boolean;
}

interface NextBinCollections {
  blueBin: Date | null;
  greenBin: Date | null;
  blackBin: Date | null;
  foodWasteBin: Date | null;
}

const BinCollectionInfo = (props: {
  nextCollectionDate: Date | null;
  isLoading: boolean;
}) => {
  if (props.isLoading) {
    return <ActivityIndicator style={{ marginTop: 16 }} />;
  }
  if (!props.nextCollectionDate) {
    return (
      <View
        style={{
          justifyContent: "center",
          alignItems: "center",
          flex: 1,
        }}
      >
        <Text
          style={{
            fontSize: theme.fontSizes.largeBody,
            color: theme.colors.primary,
            marginTop: 16,
          }}
        >
          -
        </Text>
      </View>
    );
  }
  const now = new Date();
  const diffTime = props.nextCollectionDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const formattedDate = props.nextCollectionDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (diffDays === 0) {
    return (
      <View style={styles.collectionInfoContainer}>
        <Text style={styles.highlightText}>Today</Text>
        <Text
          style={[styles.mutedText, { fontSize: theme.fontSizes.largeBody }]}
        >
          {formattedDate}
        </Text>
      </View>
    );
  } else if (diffDays === 1) {
    return (
      <View style={styles.collectionInfoContainer}>
        <Text style={styles.highlightText}>Tomorrow</Text>
        <Text
          style={[styles.mutedText, { fontSize: theme.fontSizes.largeBody }]}
        >
          {formattedDate}
        </Text>
      </View>
    );
  } else {
    return (
      <View style={styles.collectionInfoContainer}>
        <Text style={styles.highlightText}>{diffDays} days</Text>
        <Text
          style={[styles.mutedText, { fontSize: theme.fontSizes.largeBody }]}
        >
          {formattedDate}
        </Text>
      </View>
    );
  }
};

const BinCollectionTile = (props: {
  binType: string;
  nextCollectionDate: Date | null;
  isLoading: boolean;
}) => {
  const Icon = BIN_ICONS[props.binType.toLowerCase()];
  const isSoon =
    props.nextCollectionDate !== null &&
    Math.ceil(
      (props.nextCollectionDate.getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    ) <= 1;
  return (
    <View
      style={[
        globalStyles.card,
        globalStyles.tile,
        styles.tileCard,
        isSoon && styles.tileCardHighlight,
        { opacity: props.nextCollectionDate ? 1 : 0.5 },
      ]}
    >
      <View style={styles.binIconContainer}>
        <Icon width={48} height={63} style={styles.binIcon} />
        <Text style={{ color: theme.colors.neutral800 }}>{props.binType}</Text>
      </View>
      <BinCollectionInfo
        nextCollectionDate={props.nextCollectionDate}
        isLoading={props?.isLoading}
      />
    </View>
  );
};

export default function WasteCollectionSection(props: WasteCollectionProps) {
  const allBlueBinJobs = useMemo(() => {
    return _.filter(props?.binCollectionsData?.schedule, (job: any) => {
      return job?.Name?.toLowerCase() === "empty bin blue 240l";
    });
  }, [props?.binCollectionsData?.schedule]);

  const allGreenBinJobs = useMemo(() => {
    return _.filter(props?.binCollectionsData?.schedule, (job: any) => {
      return job?.Name?.toLowerCase() === "empty bin green 240l";
    });
  }, [props?.binCollectionsData?.schedule]);

  const allBlackBinJobs = useMemo(() => {
    return _.filter(props?.binCollectionsData?.schedule, (job: any) => {
      return job?.Name?.toLowerCase() === "empty bin black 240l";
    });
  }, [props?.binCollectionsData?.schedule]);
  const allFoodBinJobs = useMemo(() => {
    return _.filter(props?.binCollectionsData?.schedule, (job: any) => {
      return job?.Name?.toLowerCase() === "empty bin food waste caddy";
    });
  }, [props?.binCollectionsData?.schedule]);

  const nextCollections: NextBinCollections = useMemo(() => {
    return {
      blueBin: props?.isAddressSet
        ? getNextCollectionDate(allBlueBinJobs)
        : null,
      greenBin: props?.isAddressSet
        ? getNextCollectionDate(allGreenBinJobs)
        : null,
      blackBin: props?.isAddressSet
        ? getNextCollectionDate(allBlackBinJobs)
        : null,
      foodWasteBin: props?.isAddressSet
        ? getNextCollectionDate(allFoodBinJobs)
        : null,
    };
  }, [
    allBlueBinJobs,
    allGreenBinJobs,
    allBlackBinJobs,
    allFoodBinJobs,
    props?.isAddressSet,
  ]);

  return (
    <View>
      <Text style={[globalStyles.heading]}>Next Waste Collection</Text>

      <View style={[globalStyles.tilesRow, styles.tileRow]}>
        <BinCollectionTile
          binType="Black bin"
          nextCollectionDate={nextCollections.blackBin}
          isLoading={props?.isLoading}
        />
        <BinCollectionTile
          binType="Blue bin"
          nextCollectionDate={nextCollections.blueBin}
          isLoading={props?.isLoading}
        />
      </View>
      <View style={[globalStyles.tilesRow, styles.tileRow]}>
        <BinCollectionTile
          binType="Green bin"
          nextCollectionDate={nextCollections.greenBin}
          isLoading={props?.isLoading}
        />
        <BinCollectionTile
          binType="Food waste bin"
          nextCollectionDate={nextCollections.foodWasteBin}
          isLoading={props?.isLoading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mutedText: {
    color: theme.colors.neutral700,
  },
  highlightText: {
    color: theme.colors.tertiary,
    fontSize: theme.fontSizes.largeBody,
    fontFamily: "PlusJakartaSansBold",
    paddingBottom: 4,
  },
  tileCard: {
    backgroundColor: theme.colors.neutral100,
  },
  tileCardHighlight: {
    backgroundColor: theme.colors.white,
  },
  binIconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  binIcon: {
    marginTop: -36,
    marginBottom: 8,
  },
  tileRow: {
    paddingTop: 16,
  },
  collectionInfoContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
});
