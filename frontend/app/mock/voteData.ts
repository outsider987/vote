export const mockVoteData = {
  // 活動基本資訊
  eventBasicInfo: {
    organizationName: "臺師大EMBA校友會",
    eventTitle: "第四屆第一次會員大會-理事及監事選舉之電子投票",
    eventDate: "2025-03-15",
    eventDescription: `各位隸屬臺師大EMBA校友會會員的學長姐們好，首先感謝您參與第四屆第一次會員大會並參與「理事及監事選舉之線上投票」，請分別投給您最心中最欣賞的理事及監事候選人，您的一票對校友會的永續運作至關重要且極具寶貴。投票前請花個一分鐘撥冗閱讀以下投票規範說明，謝謝您的參與與支持；投票後期待與您一同參與「蛇燦連發春酒晚宴」活動， 好好享受今晚美好的快樂時光。再次感謝您的出席與參與!`,
    votingTimeStart: "2025-03-15T17:00:00.000Z",
    votingTimeEnd: "2025-03-15T18:30:00.000Z"
  },

  // 會員統計資訊
  memberStats: {
    totalMembers: 150,          // 總會員數
    attendees: 65,              // 出席人數
    delegatedVotes: 25,         // 委託人數
    totalAttendance: 90,        // 含授權委託之出席人數
    attendanceRate: "60%",      // 出席率
    quorumMet: true            // 是否達到法定出席人數
  },

  // 投票活動範例
  sampleVoteEvents: [
    {
      vote_id: "vote_001",
      eventDate: "2025-03-15",
      title: "理事選舉",
      memberCount: 150,
      votesPerUser: 15,        // 每人可投15票
      showCount: 18,           // 顯示前18名（正取15名+候補3名）
      options: [
        "王大明 (EMBA 111)",
        "李小華 (EMBA 112)",
        "張志豪 (EMBA 110)",
        "陳美玲 (EMBA 111)",
        "林建國 (EMBA 109)",
        "黃志偉 (EMBA 110)",
        "周淑芬 (EMBA 111)",
        "劉建宏 (EMBA 112)",
        "吳雅琪 (EMBA 109)",
        "蔡明德 (EMBA 110)",
        "鄭佳玲 (EMBA 111)",
        "許志明 (EMBA 112)",
        "楊美華 (EMBA 110)",
        "謝宗翰 (EMBA 111)",
        "潘建志 (EMBA 109)",
        "趙雅芳 (EMBA 110)",
        "沈俊宏 (EMBA 111)",
        "朱淑娟 (EMBA 112)",
        "馬建國 (EMBA 110)",
        "丁雅琳 (EMBA 111)"
      ],
      status: "pending",       // pending, active, completed
      startTime: null,
      endTime: null
    },
    {
      vote_id: "vote_002",
      eventDate: "2025-03-15",
      title: "監事選舉",
      memberCount: 150,
      votesPerUser: 5,         // 每人可投5票
      showCount: 6,            // 顯示前6名（正取5名+候補1名）
      options: [
        "周明德 (EMBA 110)",
        "黃雅琪 (EMBA 111)",
        "劉俊宏 (EMBA 112)",
        "吳淑芬 (EMBA 109)",
        "蔡志明 (EMBA 110)",
        "林美玲 (EMBA 111)",
        "張建華 (EMBA 112)",
        "王俊傑 (EMBA 110)"
      ],
      status: "pending",
      startTime: null,
      endTime: null
    }
  ],

  // QR Code 生成相關
  qrCodeSettings: {
    codesPerPage: 40,         // 一頁可印製的QR Code數量
    codeSize: "3cm",          // QR Code 尺寸
    pageSize: {
      width: "40cm",
      height: "24cm"
    }
  },

  // 會員資料範例
  sampleMembers: [
    {
      memberId: "M001",
      name: "王大明",
      embaClass: "EMBA 111",
      memberType: "基本會員",
      status: "active",
      hasVoted: false,
      delegatedBy: ["M005", "M008"]  // 新增：被委託投票的會員清單
    },
    {
      memberId: "M002",
      name: "李小華",
      embaClass: "EMBA 112",
      memberType: "基本會員",
      status: "active",
      hasVoted: false,
      delegatedTo: "M001"
    },
    {
      memberId: "M003",
      name: "張志豪",
      embaClass: "EMBA 110",
      memberType: "基本會員",
      status: "active",
      hasVoted: false,
      delegatedBy: null
    },
    {
      memberId: "M004",
      name: "陳美玲",
      embaClass: "EMBA 111",
      memberType: "基本會員",
      status: "active",
      hasVoted: true,
      delegatedBy: null
    },
    {
      memberId: "M005",
      name: "林建國",
      embaClass: "EMBA 109",
      memberType: "基本會員",
      status: "active",
      hasVoted: false,
      delegatedTo: "M001"
    }
  ],

  // API 回應範例
  apiResponses: {
    createEvent: {
      status: 200,
      data: {
        event_id: "evt_20250315001",
        message: "活動建立成功"
      }
    },
    startVoting: {
      status: 200,
      data: {
        vote_id: "vote_001",
        message: "投票已開始",
        startTime: "2025-03-15T17:00:00.000Z"
      }
    },
    endVoting: {
      status: 200,
      data: {
        vote_id: "vote_001",
        message: "投票已結束",
        endTime: "2025-03-15T18:30:00.000Z",
        results: {
          totalVotes: 90,
          validVotes: 88,
          invalidVotes: 2,
          candidates: [
            { name: "王大明", votes: 75, elected: "正取" },
            { name: "李小華", votes: 70, elected: "正取" },
            // ... 更多結果
          ]
        }
      }
    }
  }
}; 