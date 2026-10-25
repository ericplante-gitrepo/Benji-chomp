const LEVEL_PACK = [
  {
    "name": "Sunny Reef",
    "levels": [
      {
        "id": "R1",
        "name": "First Swim",
        "role": "teach",
        "goal": "reach",
        "slots": 3,
        "solution": "RRR",
        "grid": [
          "S##G"
        ],
        "source": "Dispatch (UI lesson)"
      },
      {
        "id": "R2",
        "name": "Around the Corner",
        "role": "teach",
        "goal": "reach",
        "slots": 3,
        "solution": "RDR",
        "grid": [
          "S#.",
          ".#G"
        ],
        "source": "Sol R-01"
      },
      {
        "id": "R3",
        "name": "Swirl Hop",
        "role": "teach",
        "goal": "reach",
        "slots": 2,
        "solution": "DU",
        "grid": [
          "S.G",
          "A.a"
        ],
        "source": "Opus R-02"
      },
      {
        "id": "R4",
        "name": "Stop on the Friend",
        "role": "twist",
        "goal": "fewest",
        "slots": 5,
        "solution": "RRR",
        "grid": [
          "S##G##"
        ],
        "source": "Dispatch (Hulk over-programming beat)"
      },
      {
        "id": "R5",
        "name": "Right Means Left",
        "role": "set piece",
        "goal": "reach",
        "slots": 4,
        "solution": "RRRU",
        "grid": [
          "G.S##A",
          "a....."
        ],
        "source": "Opus R-04 (Sol R-06 is the 6-arrow version)"
      },
      {
        "id": "R6",
        "name": "Prickly Shortcut",
        "role": "teach",
        "goal": "reach",
        "slots": 5,
        "solution": "RDRRU",
        "grid": [
          "S#UG",
          ".###"
        ],
        "source": "Opus R-03"
      },
      {
        "id": "R7",
        "name": "Away We Go",
        "role": "twist",
        "goal": "reach",
        "slots": 4,
        "solution": "DDLU",
        "grid": [
          "S.G.",
          "#.#a",
          "A..."
        ],
        "source": "Sol R-03"
      },
      {
        "id": "R8",
        "name": "Rescue the Twins",
        "role": "teach",
        "goal": "rescue-all",
        "slots": 6,
        "solution": "LRRLDD",
        "grid": [
          "FSF",
          ".#.",
          ".G."
        ],
        "source": "Opus R-05"
      },
      {
        "id": "R9",
        "name": "Pick a Side",
        "role": "breather",
        "goal": "fewest",
        "slots": 7,
        "solution": "RRRDD",
        "grid": [
          "S###",
          "#U.#",
          "###G"
        ],
        "source": "Sol R-09"
      },
      {
        "id": "R10",
        "name": "Buddy Bounce",
        "role": "play",
        "goal": "rescue-all",
        "slots": 6,
        "solution": "LRRRRR",
        "grid": [
          ".FS#A",
          "....U",
          "..a#G"
        ],
        "source": "Argon R-09 (3rd draft)"
      },
      {
        "id": "R11",
        "name": "Down the Hatches",
        "role": "set piece",
        "goal": "reach",
        "slots": 6,
        "solution": "DDDDDD",
        "grid": [
          "S.a.b",
          "#.#.#",
          "A.B.G"
        ],
        "source": "Opus S-03 = Sol D-10"
      }
    ]
  },
  {
    "name": "Kelp Forest",
    "levels": [
      {
        "id": "K1",
        "name": "Free Ride",
        "role": "teach",
        "goal": "reach",
        "slots": 3,
        "solution": "RRR",
        "grid": [
          "S>##G"
        ],
        "source": "Opus K-02 = Sol K-01"
      },
      {
        "id": "K2",
        "name": "Chomp the Clam",
        "role": "teach",
        "goal": "reach",
        "slots": 6,
        "solution": "RDURRR",
        "grid": [
          "S#H#G",
          ".h..."
        ],
        "source": "Opus K-01"
      },
      {
        "id": "K3",
        "name": "Two Rivers",
        "role": "twist",
        "goal": "reach",
        "slots": 4,
        "solution": "DRRD",
        "grid": [
          "S>>U",
          "#>##",
          "...G"
        ],
        "source": "Opus K-03"
      },
      {
        "id": "K4",
        "name": "Lazy River",
        "role": "breather",
        "goal": "fewest",
        "slots": 7,
        "solution": "R",
        "grid": [
          "S>>>>G",
          "######"
        ],
        "source": "Opus K-04"
      },
      {
        "id": "K5",
        "name": "Chain Slide",
        "role": "set piece",
        "goal": "reach",
        "slots": 3,
        "solution": "RDL",
        "grid": [
          "S>v",
          "#.A",
          ".a.",
          "G#."
        ],
        "source": "v11: was Triple Boost RRR (same arrows as K1). Chain is one Right, then Down Left home.",
        "replaces": "K5"
      },
      {
        "id": "K6",
        "name": "Clam First",
        "role": "play",
        "goal": "reach",
        "slots": 6,
        "solution": "DDUULL",
        "grid": [
          "GHS",
          "..#",
          "..h"
        ],
        "source": "Sol K-03"
      },
      {
        "id": "K7",
        "name": "Swim Upstream",
        "role": "twist",
        "goal": "reach",
        "slots": 4,
        "solution": "DRRU",
        "grid": [
          "S<G.",
          "###."
        ],
        "source": "Argon K-04"
      },
      {
        "id": "K8",
        "name": "Clam Express",
        "role": "play",
        "goal": "reach",
        "slots": 4,
        "solution": "URDD",
        "grid": [
          ".h>#.",
          ".S.v.",
          "...H.",
          "...G."
        ],
        "source": "Argon K-06 (revised in its trace)"
      },
      {
        "id": "K9",
        "name": "The Downslide",
        "role": "twist",
        "goal": "reach",
        "slots": 3,
        "solution": "RDL",
        "grid": [
          "S#...",
          ".v...",
          ".A...",
          "Ga..."
        ],
        "source": "Sol K-06"
      },
      {
        "id": "K10",
        "name": "Everyone Aboard",
        "role": "play",
        "goal": "rescue-all",
        "slots": 8,
        "solution": "UDLLRRRR",
        "grid": [
          "..F..",
          "F#S#G"
        ],
        "source": "Sol K-09"
      },
      {
        "id": "K11",
        "name": "Kelp Coaster",
        "role": "set piece",
        "goal": "reach",
        "slots": 6,
        "solution": "RRDDRR",
        "grid": [
          "S>#h..",
          "A..#..",
          ".a#H#G"
        ],
        "source": "Dispatch"
      }
    ]
  },
  {
    "name": "Sunken Ship",
    "levels": [
      {
        "id": "S1",
        "name": "Spines Down",
        "role": "teach",
        "goal": "reach",
        "slots": 5,
        "solution": "RDURR",
        "grid": [
          "S#MG",
          ".m.."
        ],
        "source": "Sol S-01"
      },
      {
        "id": "S2",
        "name": "Button Above",
        "role": "play",
        "goal": "reach",
        "slots": 4,
        "solution": "UDDD",
        "grid": [
          "m..",
          "S#.",
          "M#.",
          "G.."
        ],
        "source": "v11: was Flat Spikes LRRRR, another button detour beside S1. Button is above the start.",
        "replaces": "S2"
      },
      {
        "id": "S3",
        "name": "Button Island",
        "role": "twist",
        "goal": "reach",
        "slots": 6,
        "solution": "DLRURR",
        "grid": [
          "SMG",
          "A..",
          "ma."
        ],
        "source": "Opus S-01 (Hulk level 2)"
      },
      {
        "id": "S4",
        "name": "Slide and Press",
        "role": "breather",
        "goal": "reach",
        "slots": 3,
        "solution": "RDD",
        "grid": [
          "S>m",
          "..M",
          "..G"
        ],
        "source": "Dispatch"
      },
      {
        "id": "S5",
        "name": "One-Way Chute",
        "role": "set piece",
        "goal": "reach",
        "slots": 7,
        "solution": "RDRUURR",
        "grid": [
          "S#M#G",
          ".v#..",
          ".m#.."
        ],
        "source": "Opus S-02"
      },
      {
        "id": "S6",
        "name": "Look Before You Slide",
        "role": "twist",
        "goal": "reach",
        "slots": 5,
        "solution": "UDRRD",
        "grid": [
          ".m...",
          ".S#>M",
          "....G"
        ],
        "source": "Argon S-09"
      },
      {
        "id": "S7",
        "name": "Spike Bridge Rescue",
        "role": "play",
        "goal": "rescue-all",
        "slots": 7,
        "solution": "DURRRRD",
        "grid": [
          "S#M#F",
          "m...G"
        ],
        "source": "Dispatch"
      },
      {
        "id": "S8",
        "name": "Short Way Home",
        "role": "twist",
        "goal": "fewest",
        "slots": 8,
        "solution": "RDURRR",
        "grid": [
          "S#M#G",
          ".m..^",
          ".####"
        ],
        "source": "Sol S-09 (tray 9 -> 8)"
      },
      {
        "id": "S9",
        "name": "Press on the Way",
        "role": "breather",
        "goal": "reach",
        "slots": 5,
        "solution": "RRRRR",
        "grid": [
          "Sm#M#G"
        ],
        "source": "Dispatch"
      },
      {
        "id": "S10",
        "name": "There and Back",
        "role": "set piece",
        "goal": "reach",
        "slots": 7,
        "solution": "RRLLDRR",
        "grid": [
          "Sa...",
          "B....",
          "bMG..",
          "...Am"
        ],
        "source": "Sol S-05"
      }
    ]
  },
  {
    "name": "Deep Sea",
    "levels": [
      {
        "id": "D1",
        "name": "Jelly Hello",
        "role": "teach",
        "goal": "reach",
        "slots": 3,
        "solution": "RRR",
        "grid": [
          "SJ#G"
        ],
        "source": "Sol D-01"
      },
      {
        "id": "D2",
        "name": "Bobbing Bend",
        "role": "play",
        "goal": "reach",
        "slots": 5,
        "solution": "RRUUL",
        "grid": [
          ".G#",
          ".J#",
          "S##"
        ],
        "source": "v11: was Bobbing Jelly RRRRR, all Rights after D1. Cross the jelly on arrow 3 after a turn.",
        "replaces": "D2"
      },
      {
        "id": "D3",
        "name": "Beat the Jelly",
        "role": "twist",
        "goal": "reach",
        "slots": 4,
        "solution": "DRUR",
        "grid": [
          "S#JG",
          "#>#."
        ],
        "source": "Argon D-02 (Sol D-04 is the same idea)"
      },
      {
        "id": "D4",
        "name": "Glow Slide",
        "role": "breather",
        "goal": "reach",
        "slots": 2,
        "solution": "RR",
        "grid": [
          "SJ>>>G"
        ],
        "source": "Dispatch"
      },
      {
        "id": "D5",
        "name": "Deep Sea Dash",
        "role": "set piece",
        "goal": "reach",
        "slots": 6,
        "solution": "LRRRDD",
        "grid": [
          "mSMAa",
          "....J",
          "....G"
        ],
        "source": "Argon D-10"
      },
      {
        "id": "D6",
        "name": "Wait a Beat",
        "role": "twist",
        "goal": "reach",
        "slots": 5,
        "solution": "DURRR",
        "grid": [
          "S#J#G",
          "Aa..."
        ],
        "source": "Opus D-02"
      },
      {
        "id": "D7",
        "name": "Two Jellies",
        "role": "play",
        "goal": "reach",
        "slots": 5,
        "solution": "DRURR",
        "grid": [
          "SJJ#G",
          "#>#.."
        ],
        "source": "Dispatch"
      },
      {
        "id": "D8",
        "name": "Around the Sting",
        "role": "breather",
        "goal": "reach",
        "slots": 2,
        "solution": "DD",
        "grid": [
          "S#J",
          "A.a",
          "..G"
        ],
        "source": "v11: was Jelly Hatches DDDDDD, jelly safe with no choice. Rights zap; Down into the tube.",
        "replaces": "D8"
      },
      {
        "id": "D9",
        "name": "Dark Rescue",
        "role": "twist",
        "goal": "rescue-all",
        "slots": 5,
        "solution": "DLURR",
        "grid": [
          "S#J#G",
          "A.Fa."
        ],
        "source": "Dispatch"
      },
      {
        "id": "D10",
        "name": "Two Roads in the Dark",
        "role": "play",
        "goal": "fewest",
        "slots": 8,
        "solution": "DRURR",
        "grid": [
          "S#J#G",
          "#>#.#",
          "#####"
        ],
        "source": "Dispatch"
      },
      {
        "id": "D11",
        "name": "Benji's Big Swim",
        "role": "set piece",
        "goal": "reach",
        "slots": 8,
        "solution": "RRDLLDLL",
        "grid": [
          "S#h...",
          "..v...",
          "AH#...",
          ".....a",
          "...GJ#"
        ],
        "source": "Opus D-03"
      }
    ]
  }
];
