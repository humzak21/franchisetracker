/**
 * A slice of real nflverse files (2024 and 2025 standings and playoff games, the sample roster's players, their
 * season stats, 2026 roster rows and draft picks), trimmed to the columns the parsers read.
 * Feeds the parser tests and the sample franchise's pre-franchise history.
 */
// prettier-ignore
export const NFLVERSE_SAMPLE = {
  standings: `season,team,wins,losses,ties,div_rank,scored,allowed,seed
2024,BUF,13,4,0,1,525,368,2
2024,MIA,8,9,0,2,345,364,
2024,NE,4,13,0,4,289,417,
2024,NYJ,5,12,0,3,338,404,
2024,BAL,12,5,0,1,518,361,3
2024,CIN,9,8,0,3,472,434,
2024,CLE,3,14,0,4,258,435,
2024,PIT,10,7,0,2,380,347,6
2024,HOU,10,7,0,1,372,372,4
2024,IND,8,9,0,2,377,427,
2024,JAX,4,13,0,3,320,435,
2024,TEN,3,14,0,4,311,460,
2024,DEN,10,7,0,3,425,311,7
2024,KC,15,2,0,1,385,326,1
2024,LAC,11,6,0,2,402,301,5
2024,LV,4,13,0,4,309,434,
2024,DAL,7,10,0,3,350,468,
2024,NYG,3,14,0,4,273,415,
2024,PHI,14,3,0,1,463,303,2
2024,WAS,12,5,0,2,485,391,6
2024,CHI,5,12,0,4,310,370,
2024,DET,15,2,0,1,564,342,1
2024,GB,11,6,0,3,460,338,7
2024,MIN,14,3,0,2,432,332,5
2024,ATL,8,9,0,2,389,423,
2024,CAR,5,12,0,3,341,534,
2024,NO,5,12,0,4,338,398,
2024,TB,10,7,0,1,502,385,3
2024,ARI,8,9,0,3,400,379,
2024,LA,10,7,0,1,367,386,4
2024,SEA,10,7,0,2,375,368,
2024,SF,6,11,0,4,389,436,
2025,BUF,12,5,0,2,481,365,6
2025,MIA,7,10,0,3,347,424,
2025,NE,14,3,0,1,490,320,2
2025,NYJ,3,14,0,4,300,503,
2025,BAL,8,9,0,2,424,398,
2025,CIN,6,11,0,3,414,492,
2025,CLE,5,12,0,4,279,379,
2025,PIT,10,7,0,1,397,387,4
2025,HOU,12,5,0,2,404,295,5
2025,IND,8,9,0,3,466,412,
2025,JAX,13,4,0,1,474,336,3
2025,TEN,3,14,0,4,284,478,
2025,DEN,14,3,0,1,401,311,1
2025,KC,6,11,0,3,362,328,
2025,LAC,11,6,0,2,368,340,7
2025,LV,3,14,0,4,241,432,
2025,DAL,7,9,1,2,471,511,
2025,NYG,4,13,0,4,381,439,
2025,PHI,11,6,0,1,379,325,3
2025,WAS,5,12,0,3,356,451,
2025,CHI,11,6,0,1,441,415,2
2025,DET,9,8,0,4,481,413,
2025,GB,9,7,1,2,391,360,7
2025,MIN,9,8,0,3,344,333,
2025,ATL,8,9,0,3,353,401,
2025,CAR,8,9,0,1,311,380,4
2025,NO,6,11,0,4,306,383,
2025,TB,8,9,0,2,380,411,
2025,ARI,3,14,0,4,355,488,
2025,LA,12,5,0,2,518,346,5
2025,SEA,14,3,0,1,483,292,1
2025,SF,12,5,0,3,437,371,6
`,
  playoffGames: `season,game_type,away_team,away_score,home_team,home_score
2024,WC,LAC,12,HOU,32
2024,WC,PIT,14,BAL,28
2024,WC,DEN,7,BUF,31
2024,WC,GB,10,PHI,22
2024,WC,WAS,23,TB,20
2024,WC,MIN,9,LA,27
2024,DIV,HOU,14,KC,23
2024,DIV,WAS,45,DET,31
2024,DIV,LA,22,PHI,28
2024,DIV,BAL,25,BUF,27
2024,CON,WAS,23,PHI,55
2024,CON,BUF,29,KC,32
2024,SB,KC,22,PHI,40
2025,WC,LA,34,CAR,31
2025,WC,GB,27,CHI,31
2025,WC,BUF,27,JAX,24
2025,WC,SF,23,PHI,19
2025,WC,LAC,3,NE,16
2025,WC,HOU,30,PIT,6
2025,DIV,BUF,30,DEN,33
2025,DIV,SF,6,SEA,41
2025,DIV,HOU,16,NE,28
2025,DIV,LA,20,CHI,17
2025,CON,NE,10,DEN,7
2025,CON,LA,27,SEA,31
2025,SB,SEA,29,NE,13
`,
  players: `gsis_id,display_name,first_name,last_name,birth_date,position,height,weight,college_name,espn_id,rookie_season,last_season,draft_year,draft_round,draft_pick,draft_team
00-0031588,Stefon Diggs,Stefon,Diggs,1993-11-29,WR,72,191,Maryland,2976212,2015,2026,2015,5,146,MIN
00-0038621,DeMario Douglas,DeMario,Douglas,2000-12-08,WR,68,185,Liberty,4427095,2023,2026,2023,6,210,NE
00-0039147,Christian Gonzalez,Christian,Gonzalez,2002-06-28,CB,73,205,Oregon,4686772,2023,2026,2023,1,17,NE
00-0040734,TreVeyon Henderson,TreVeyon,Henderson,2002-10-22,RB,70,202,Ohio State,4432710,2025,2026,2025,2,38,NE
00-0033090,Hunter Henry,Hunter,Henry,1994-12-07,TE,77,249,Arkansas,3046439,2016,2026,2016,2,35,LAC
00-0039851,Drake Maye,Drake,Maye,2002-08-30,QB,76,225,North Carolina,4431452,2024,2026,2024,1,3,NE
00-0034720,Robert Spillane,Robert,Spillane,1995-12-14,LB,73,234,Western Michigan,3129446,2018,2026,,,,
`,
  seasonStats: {
    2024: { regular: `player_id,recent_team,position,games,completions,attempts,passing_yards,passing_tds,passing_interceptions,sacks_suffered,sack_yards_lost,passing_yards_after_catch,carries,rushing_yards,rushing_tds,receptions,targets,receiving_yards,receiving_tds,receiving_yards_after_catch,def_tackles_solo,def_tackle_assists,def_tackles_for_loss,def_sacks,def_interceptions,def_interception_yards,def_pass_defended,fumble_recovery_opp,fumble_recovery_tds,fumbles_total
00-0031588,HOU,WR,8,1,1,13,0,0,0,0,17,3,8,1,47,64,496,3,185,1,0,0,0,0,0,0,0,0,0
00-0033090,NE,TE,16,0,0,0,0,0,0,0,0,0,0,0,66,97,674,2,268,0,0,0,0,0,0,0,0,0,0
00-0034720,LV,LB,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,76,67,10,2,2,0,7,0,0,0
00-0038621,NE,WR,16,0,0,0,0,0,0,0,0,3,16,0,66,87,621,3,359,1,0,0,0,0,0,0,0,0,1
00-0039147,NE,CB,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,45,9,1,0,2,2,11,1,1,0
00-0039851,NE,QB,13,225,338,2276,15,10,34,-229,1192,54,421,2,0,0,0,0,0,1,0,0,0,0,0,0,0,0,9
`, postseason: `player_id,recent_team,position,games
` },
    2025: { regular: `player_id,recent_team,position,games,completions,attempts,passing_yards,passing_tds,passing_interceptions,sacks_suffered,sack_yards_lost,passing_yards_after_catch,carries,rushing_yards,rushing_tds,receptions,targets,receiving_yards,receiving_tds,receiving_yards_after_catch,def_tackles_solo,def_tackle_assists,def_tackles_for_loss,def_fumbles_forced,def_sacks,def_interceptions,def_interception_yards,def_pass_defended,fumbles_total,kickoff_returns,kickoff_return_yards
00-0031588,NE,WR,17,0,0,0,0,0,0,0,0,0,0,0,85,102,1013,4,354,2,0,0,0,0,0,0,0,0,0,0
00-0033090,NE,TE,17,0,0,0,0,0,0,0,0,0,0,0,60,87,768,7,335,0,0,0,0,0,0,0,0,0,0,0
00-0034720,NE,LB,13,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,47,49,4,1,1,2,70,5,0,0,0
00-0038621,NE,WR,16,0,0,0,0,0,0,0,0,7,21,0,31,46,447,3,214,0,0,0,0,0,0,0,0,0,0,0
00-0039147,NE,CB,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,53,15,1,0,0,0,0,10,0,0,0
00-0039851,NE,QB,17,354,492,4394,31,8,47,-201,1746,103,450,4,1,1,2,0,10,0,0,0,0,0,0,0,0,8,0,0
00-0040734,NE,RB,17,0,0,0,0,0,0,0,0,180,911,9,35,42,221,1,244,0,0,0,0,0,0,0,0,1,9,209
`, postseason: `player_id,recent_team,position,games,completions,attempts,passing_yards,passing_tds,passing_interceptions,sacks_suffered,sack_yards_lost,passing_yards_after_catch,carries,rushing_yards,rushing_tds,receptions,targets,receiving_yards,receiving_tds,receiving_yards_after_catch,def_tackles_solo,def_tackle_assists,def_tackles_for_loss,def_fumbles_forced,def_sacks,def_interceptions,def_pass_defended,fumbles_total,kickoff_returns,kickoff_return_yards
00-0031588,NE,WR,4,0,0,0,0,0,0,0,0,0,0,0,14,20,110,1,44,0,0,0,0,0,0,0,0,0,0
00-0033090,NE,TE,4,0,0,0,0,0,0,0,0,0,0,0,9,15,112,1,35,0,0,0,0,0,0,0,0,0,0
00-0034720,NE,LB,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,12,0,0,0,0,2,0,0,0
00-0038621,NE,WR,4,0,0,0,0,0,0,0,0,0,0,0,8,12,84,1,59,0,0,0,0,0,0,0,0,0,0
00-0039147,NE,CB,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,15,4,1,1,1,1,7,0,0,0
00-0039851,NE,QB,4,70,120,828,6,4,21,-133,408,29,178,1,0,1,0,0,0,0,0,0,0,0,0,0,7,0,0
00-0040734,NE,RB,4,0,0,0,0,0,0,0,0,30,76,0,5,6,33,0,41,1,0,0,0,0,0,0,0,1,38
` },
  },
  roster2026: `season,team,position,depth_chart_position,jersey_number,status,full_name,first_name,last_name,birth_date,height,weight,college,gsis_id,espn_id,years_exp,entry_year,draft_club
2026,WAS,WR,WR,3,ACT,Stefon Diggs,Stefon,Diggs,1993-11-29,72,191,Maryland,00-0031588,2976212,11,2015,MIN
2026,NE,TE,TE,85,ACT,Hunter Henry,Hunter,Henry,1994-12-07,77,250,Arkansas,00-0033090,3046439,10,2016,SD
2026,NE,LB,ILB,14,ACT,Robert Spillane,Robert,Spillane,1995-12-14,73,234,Western Michigan,00-0034720,3129446,8,2018,
2026,NE,WR,WR,3,ACT,DeMario Douglas,Demario,Douglas,2000-12-08,68,185,Liberty,00-0038621,4427095,3,2023,NE
2026,NE,DB,CB,0,ACT,Christian Gonzalez,Christian,Gonzalez,2002-06-28,73,205,Oregon,00-0039147,4686772,3,2023,NE
2026,NE,QB,QB,10,ACT,Drake Maye,Drake,Maye,2002-08-30,76,225,North Carolina,00-0039851,4431452,2,2024,NE
2026,NE,RB,RB,32,ACT,TreVeyon Henderson,TreVeyon,Henderson,2002-10-22,70,202,Ohio State,00-0040734,4432710,1,2025,NE
`,
  draftPicks: `season,round,pick,team,gsis_id,pfr_player_name,position,college
2015,5,146,MIN,00-0031588,Stefon Diggs,WR,Maryland
2016,2,35,SDG,00-0033090,Hunter Henry,TE,Arkansas
2023,1,17,NWE,00-0039147,Christian Gonzalez,DB,Oregon
2023,6,210,NWE,00-0038621,DeMario Douglas,WR,Liberty
2024,1,3,NWE,00-0039851,Drake Maye,QB,North Carolina
2025,2,38,NWE,00-0040734,TreVeyon Henderson,RB,Ohio St.
`,
} as const;
