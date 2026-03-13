
import { Router } from "express";
import {
  getCoinsTopGainers,
  getCoinsTopVolume24h,
  getCoinsMostValuable,
  getCoinsNew,
  getCreatorCoins,
  getMostValuableCreatorCoins,
} from "@zoralabs/coins-sdk";

export function registerZoraExploreRoutes(app: Router) {
  // Get top gaining coins from Zora
  app.get("/api/zora/coins/top-gainers", async (req, res) => {
    try {
      const count = parseInt(req.query.count as string) || 20;
      const after = req.query.after as string | undefined;

      const response = await getCoinsTopGainers({ count, after });
      const coins = response.data?.exploreList?.edges?.map((edge: any) => edge.node) || [];
      const pageInfo = response.data?.exploreList?.pageInfo;

      res.json({ coins, pageInfo });
    } catch (error: any) {
      console.error("Error fetching top gainers from Zora:", error);
      res.status(500).json({ error: error.message || "Failed to fetch top gainers" });
    }
  });

  // Get top volume coins from Zora
  app.get("/api/zora/coins/top-volume", async (req, res) => {
    try {
      const count = parseInt(req.query.count as string) || 20;
      const after = req.query.after as string | undefined;

      const response = await getCoinsTopVolume24h({ count, after });
      const coins = response.data?.exploreList?.edges?.map((edge: any) => edge.node) || [];
      const pageInfo = response.data?.exploreList?.pageInfo;

      res.json({ coins, pageInfo });
    } catch (error: any) {
      console.error("Error fetching top volume from Zora:", error);
      res.status(500).json({ error: error.message || "Failed to fetch top volume coins" });
    }
  });

  // Get most valuable coins from Zora
  app.get("/api/zora/coins/most-valuable", async (req, res) => {
    try {
      const count = parseInt(req.query.count as string) || 20;
      const after = req.query.after as string | undefined;

      const response = await getCoinsMostValuable({ count, after });
      const coins = response.data?.exploreList?.edges?.map((edge: any) => edge.node) || [];
      const pageInfo = response.data?.exploreList?.pageInfo;

      res.json({ coins, pageInfo });
    } catch (error: any) {
      console.error("Error fetching most valuable from Zora:", error);
      res.status(500).json({ error: error.message || "Failed to fetch most valuable coins" });
    }
  });

  // Get new coins from Zora
  app.get("/api/zora/coins/new", async (req, res) => {
    try {
      const count = parseInt(req.query.count as string) || 20;
      const after = req.query.after as string | undefined;

      const response = await getCoinsNew({ count, after });
      const coins = response.data?.exploreList?.edges?.map((edge: any) => edge.node) || [];
      const pageInfo = response.data?.exploreList?.pageInfo;

      res.json({ coins, pageInfo });
    } catch (error: any) {
      console.error("Error fetching new coins from Zora:", error);
      res.status(500).json({ error: error.message || "Failed to fetch new coins" });
    }
  });

  // Get creator coins from Zora
  app.get("/api/zora/creators/coins", async (req, res) => {
    try {
      const count = parseInt(req.query.count as string) || 20;
      const after = req.query.after as string | undefined;

      const response = await getCreatorCoins({ count, after });
      const coins = response.data?.exploreList?.edges?.map((edge: any) => edge.node) || [];
      const pageInfo = response.data?.exploreList?.pageInfo;

      res.json({ coins, pageInfo });
    } catch (error: any) {
      console.error("Error fetching creator coins from Zora:", error);
      res.status(500).json({ error: error.message || "Failed to fetch creator coins" });
    }
  });

  // Get most valuable creator coins from Zora
  app.get("/api/zora/creators/most-valuable", async (req, res) => {
    try {
      const count = parseInt(req.query.count as string) || 20;
      const after = req.query.after as string | undefined;

      const response = await getMostValuableCreatorCoins({ count, after });
      const coins = response.data?.exploreList?.edges?.map((edge: any) => edge.node) || [];
      const pageInfo = response.data?.exploreList?.pageInfo;

      res.json({ coins, pageInfo });
    } catch (error: any) {
      console.error("Error fetching most valuable creator coins from Zora:", error);
      res.status(500).json({ error: error.message || "Failed to fetch most valuable creator coins" });
    }
  });
}
