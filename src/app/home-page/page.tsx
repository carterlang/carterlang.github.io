"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLink, BarChart2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ListeningEntry {
  ts: string;
  platform: string;
  ms_played: number;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string;
  reason_start: string;
  reason_end: string;
  shuffle: boolean;
  skipped: boolean;
  offline: boolean;
  offline_timestamp: string | null;
  incognito_mode: boolean;
}

function msToMinutes(ms: number): number {
  return ms / 60000;
}

function formatDate(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
];

const App = () => {
  const [listeningData, setListeningData] = useState<ListeningEntry[]>([]);
  const [sortByListens, setSortByListens] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 30;
  const [originalData, setOriginalData] = useState<ListeningEntry[]>([]);
  const [trackListenCounts, setTrackListenCounts] = useState<
    Map<string, { count: number; entry: ListeningEntry; totalMsPlayed: number }>
  >(new Map());
  const [artistStats, setArtistStats] = useState<
    { artist: string; minutes: number }[]
  >([]);
  const [longestStretch, setLongestStretch] = useState<{
    start: string;
    end: string;
    minutes: number;
  } | null>(null);
  const [showGraphs, setShowGraphs] = useState(false);
  const [monthlyData, setMonthlyData] = useState<
    { month: string; minutes: number }[]
  >([]);
  const [monthlySkipData, setMonthlySkipData] = useState<
    { month: string; skipped: number; total: number; skipRate: number }[]
  >([]);
  const [timeOfDayData, setTimeOfDayData] = useState<
    { hour: string; minutes: number }[]
  >([]);

  const calculateChartData = (data: ListeningEntry[]) => {
    const monthlyMap = new Map<string, number>();
    const monthlySkipMap = new Map<
      string,
      { skipped: number; total: number }
    >();
    const timeOfDayMap = new Map<string, number>();

    data.forEach((entry) => {
      const date = new Date(entry.ts);
      const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
      const hour = date.getHours();
      const hourLabel = `${hour}:00-${hour + 1}:00`;
      const minutes = msToMinutes(entry.ms_played || 0);

      // Monthly listening time
      monthlyMap.set(monthYear, (monthlyMap.get(monthYear) || 0) + minutes);

      // Monthly skip data
      const skipData = monthlySkipMap.get(monthYear) || {
        skipped: 0,
        total: 0,
      };
      skipData.total += 1;
      if (entry.skipped) skipData.skipped += 1;
      monthlySkipMap.set(monthYear, skipData);

      // Time of day data
      timeOfDayMap.set(hourLabel, (timeOfDayMap.get(hourLabel) || 0) + minutes);
    });

    setMonthlyData(
      Array.from(monthlyMap.entries())
        .map(([month, minutes]) => ({ month, minutes }))
        .sort((a, b) => a.month.localeCompare(b.month))
    );

    setMonthlySkipData(
      Array.from(monthlySkipMap.entries())
        .map(([month, { skipped, total }]) => ({
          month,
          skipped,
          total,
          skipRate: (skipped / total) * 100,
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
    );

    setTimeOfDayData(
      Array.from(timeOfDayMap.entries())
        .map(([hour, minutes]) => ({ hour, minutes }))
        .sort(
          (a, b) =>
            parseInt(a.hour.split(":")[0]) - parseInt(b.hour.split(":")[0])
        )
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileReaders: Promise<ListeningEntry[]>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      const promise = new Promise<ListeningEntry[]>((resolve) => {
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const data = JSON.parse(content) as ListeningEntry[];
          resolve(data);
        };
      });

      fileReaders.push(promise);
      reader.readAsText(file);
    }

    Promise.all(fileReaders).then((results) => {
      const combinedData = results.flatMap((result) => result || []);
      const filteredData = combinedData.filter(
        (entry) =>
          entry?.master_metadata_track_name?.trim() &&
          entry?.master_metadata_album_artist_name?.trim() &&
          entry?.spotify_track_uri?.startsWith("spotify:track:")
      );

      const sortedByDate = [...filteredData].sort(
        (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
      );

      setOriginalData(sortedByDate);
      setListeningData(sortedByDate);
      calculateArtistStats(sortedByDate);
      calculateLongestStretch(sortedByDate);
      calculateChartData(sortedByDate);
    });
  };

  const calculateArtistStats = (data: ListeningEntry[]) => {
    const artistMap = new Map<string, number>();

    data.forEach((entry) => {
      const artist =
        entry.master_metadata_album_artist_name || "Unknown Artist";
      const minutes = msToMinutes(entry.ms_played || 0);
      artistMap.set(artist, (artistMap.get(artist) || 0) + minutes);
    });

    setArtistStats(
      Array.from(artistMap.entries()).map(([artist, minutes]) => ({
        artist,
        minutes,
      }))
    );
  };

  const calculateLongestStretch = (data: ListeningEntry[]) => {
    let longestGap = 0;
    let longestStart = "";
    let longestEnd = "";

    for (let i = 1; i < data.length; i++) {
      const prevTimestamp = new Date(data[i - 1].ts).getTime();
      const currentTimestamp = new Date(data[i].ts).getTime();
      const gap = currentTimestamp - prevTimestamp;

      if (gap > longestGap) {
        longestGap = gap;
        longestStart = data[i - 1].ts;
        longestEnd = data[i].ts;
      }
    }

    setLongestStretch({
      start: longestStart,
      end: longestEnd,
      minutes: msToMinutes(longestGap),
    });
  };

  const sortByMostListens = () => {
    const counts = new Map<
      string,
      { count: number; entry: ListeningEntry; totalMsPlayed: number }
    >();

    originalData.forEach((entry) => {
      const trackUri = entry.spotify_track_uri;
      if (trackUri) {
        const existing = counts.get(trackUri) || {
          count: 0,
          entry,
          totalMsPlayed: 0,
        };
        existing.count += 1;
        existing.totalMsPlayed += entry.ms_played || 0;
        counts.set(trackUri, existing);
      }
    });

    const sortedByListens = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .map((item) => item.entry);

    setListeningData(sortedByListens);
    setTrackListenCounts(counts);
    setSortByListens(true);
  };

  const sortByOldest = () => {
    const sortedByDate = [...originalData].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );
    setListeningData(sortedByDate);
    setSortByListens(false);
  };

  const totalMsPlayed = listeningData.reduce(
    (sum, entry) => sum + (entry.ms_played || 0),
    0
  );
  const totalMinutesPlayed = msToMinutes(totalMsPlayed);
  const totalTracksPlayed = listeningData.filter(
    (entry) => entry.master_metadata_track_name
  ).length;

  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = listeningData.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    if (
      newPage >= 1 &&
      newPage <= Math.ceil(listeningData.length / itemsPerPage)
    ) {
      setPage(newPage);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div className="flex justify-end" id="top">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="bg-black">
              <AvatarImage src="https://imgs.search.brave.com/FwvslqIfrJSkk_ce4dcoqQ-eCB4CoZ1iJQUytek5GFA/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly91cGxv/YWQud2lraW1lZGlh/Lm9yZy93aWtpcGVk/aWEvY29tbW9ucy8x/LzE5L1Nwb3RpZnlf/bG9nb193aXRob3V0/X3RleHQuc3Zn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>
              <a
                href="https://open.spotify.com"
                className="flex justify-between"
                target="_blank"
              >
                My Spotify
                {<ExternalLink className="size-3" />}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem>Help</DropdownMenuItem>
            <DropdownMenuItem>Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex justify-center mt-3">
        <input
          type="file"
          accept=".json"
          multiple
          onChange={handleFileUpload}
          className="border border-gray-200 p-2 rounded-md"
        />
      </div>

      <div className="flex justify-center mt-3 gap-4">
        <Card className="w-2/5">
          <CardHeader>
            <CardTitle>Listening Summary</CardTitle>
            <CardDescription>Your Spotify Listening History</CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              The graphs show: Your listening trends over months How picky
              you've been with songs (skip rate) When during the day you listen
              to music most
            </p>
            <p>Total Minutes Played: {totalMinutesPlayed.toFixed(2)}</p>
          </CardContent>
          <CardContent>
            <p>Total Tracks Played: {totalTracksPlayed}</p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <p>
              <strong>Demo</strong>
            </p>
            <Button
              onClick={() => setShowGraphs(!showGraphs)}
              variant="outline"
              className="flex gap-2"
            >
              <BarChart2 className="size-4" />
              {showGraphs ? "Hide Graphs" : "Show Graphs"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {showGraphs && (
        <div className="space-y-6 mt-6">
          {monthlyData.length > 0 && (
            <div className="flex justify-center">
              <Card className="w-2/3">
                <CardHeader>
                  <CardTitle>Monthly Listening Time</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis
                        label={{
                          value: "Minutes",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip
                        formatter={(value) => [
                          `${value} minutes`,
                          "Listening Time",
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="minutes"
                        stroke="#8884d8"
                        activeDot={{ r: 8 }}
                        name="Listening Time"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {monthlySkipData.length > 0 && (
            <div className="flex justify-center">
              <Card className="w-2/3">
                <CardHeader>
                  <CardTitle>Pickiness Chart (Skipped Songs)</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySkipData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        stroke="#8884d8"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#82ca9d"
                      />
                      <Tooltip />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="skipRate"
                        name="Skip Rate (%)"
                        fill="#8884d8"
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="skipped"
                        name="Skipped Songs"
                        fill="#82ca9d"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {timeOfDayData.length > 0 && (
            <div className="flex justify-center">
              <Card className="w-2/3">
                <CardHeader>
                  <CardTitle>Listening Time by Hour of Day</CardTitle>
                </CardHeader>
                <CardContent className="h-[600px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={timeOfDayData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="minutes"
                        nameKey="hour"
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {timeOfDayData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [
                          `${value} minutes`,
                          "Listening Time",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {longestStretch && (
        <div className="flex justify-center mt-6">
          <Card className="w-2/3">
            <CardHeader>
              <CardTitle>Longest Stretch Between Listening</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                <strong>Start:</strong> {formatDate(longestStretch.start)}
              </p>
              <p>
                <strong>End:</strong> {formatDate(longestStretch.end)}
              </p>
              <p>
                <strong>Duration:</strong> {longestStretch.minutes.toFixed(2)}{" "}
                minutes
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <h2 className="font-bold flex justify-center mt-3 text-[20px]">
        All Listening Entries
      </h2>
      <Button
        className="mt-8 mb-4"
        onClick={sortByListens ? sortByOldest : sortByMostListens}
      >
        {sortByListens ? "Sort by Oldest" : "Sort by Most Listens"}
      </Button>
      <ol className="list-decimal">
        {paginatedData.map((entry, index) => (
          <li
            key={index}
            className="border border-gray-200 m-4 rounded-md shadow-md p-3 w-1/2"
          >
            <a
              href={`https://open.spotify.com/search/${entry.master_metadata_track_name}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {entry.master_metadata_track_name} by{" "}
              {entry.master_metadata_album_artist_name} -{" "}
              {msToMinutes(entry.ms_played).toFixed(2)} min
              {!sortByListens && <span> ({formatDate(entry.ts)})</span>}
              {sortByListens && (
                <span>
                  {" "}
                  (Listened{" "}
                  {trackListenCounts.get(entry.spotify_track_uri)?.count} times,
                  Total:{" "}
                  {msToMinutes(
                    trackListenCounts.get(entry.spotify_track_uri)
                      ?.totalMsPlayed || 0
                  ).toFixed(2)}{" "}
                  min)
                </span>
              )}
            </a>
          </li>
        ))}
      </ol>

      <Pagination id="bottom">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              className="cursor-pointer"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="cursor-default">
              Page {page} of {Math.ceil(listeningData.length / itemsPerPage)}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              className="cursor-pointer"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === Math.ceil(listeningData.length / itemsPerPage)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export default App;
