// Scratch test script to test schedule validation logic in isolation

const dayLabels = {
  'T2': 'Thứ 2',
  'T3': 'Thứ 3',
  'T4': 'Thứ 4',
  'T5': 'Thứ 5',
  'T6': 'Thứ 6',
  'T7': 'Thứ 7',
  'CN': 'Chủ nhật'
}

function timeToMinutes(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  return hh * 60 + mm;
}

function validateSchedule(scheduleStr) {
  if (!scheduleStr) return { valid: true };
  const parts = scheduleStr.split(',').map(p => p.trim());
  const sessions = [];
  
  for (const part of parts) {
    if (!part) continue;
    const match = part.match(/^([A-Z0-9]+)\((\d{2}:\d{2})-(\d{2}:\d{2})\)$/i);
    if (!match) {
      return { valid: false, error: `Định dạng lịch học không hợp lệ: ${part}` };
    }
    const day = match[1].toUpperCase();
    const startTime = match[2];
    const endTime = match[3];
    if (startTime >= endTime) {
      return { valid: false, error: `Giờ bắt đầu (${startTime}) phải nhỏ hơn giờ kết thúc (${endTime}).` };
    }
    sessions.push({ day, startTime, endTime });
  }

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const s1 = sessions[i];
      const s2 = sessions[j];
      if (s1.day === s2.day) {
        const m1_start = timeToMinutes(s1.startTime);
        const m1_end = timeToMinutes(s1.endTime);
        const m2_start = timeToMinutes(s2.startTime);
        const m2_end = timeToMinutes(s2.endTime);

        const [firstStart, firstEnd, secondStart, secondEnd] = m1_start <= m2_start
          ? [m1_start, m1_end, m2_start, m2_end]
          : [m2_start, m2_end, m1_start, m1_end];

        if (secondStart < firstEnd + 5) {
          const dayText = dayLabels[s1.day] || s1.day;
          return {
            valid: false,
            error: `Lịch học vào ${dayText} (${s1.startTime}-${s1.endTime} và ${s2.startTime}-${s2.endTime}) phải cách nhau ít nhất 5 phút để sinh viên kịp di chuyển giữa các phòng học.`
          };
        }
      }
    }
  }
  return { valid: true, sessions };
}

// Test cases
const testCases = [
  {
    input: "T2(07:30-10:00), T3(08:30-11:00)",
    expectedValid: true
  },
  {
    input: "T2(07:30-10:00), T2(10:00-12:00)",
    expectedValid: false, // Now invalid because gap is 0 minutes (< 5)
    expectedError: "Lịch học vào Thứ 2 (07:30-10:00 và 10:00-12:00) phải cách nhau ít nhất 5 phút để sinh viên kịp di chuyển giữa các phòng học."
  },
  {
    input: "T2(07:30-10:00), T2(10:04-12:00)",
    expectedValid: false, // Invalid because gap is 4 minutes (< 5)
    expectedError: "Lịch học vào Thứ 2 (07:30-10:00 và 10:04-12:00) phải cách nhau ít nhất 5 phút để sinh viên kịp di chuyển giữa các phòng học."
  },
  {
    input: "T2(07:30-10:00), T2(10:05-12:00)",
    expectedValid: true // Valid because gap is exactly 5 minutes
  },
  {
    input: "T2(07:30-10:00), T2(08:30-11:00)",
    expectedValid: false,
    expectedError: "Lịch học vào Thứ 2 (07:30-10:00 và 08:30-11:00) phải cách nhau ít nhất 5 phút để sinh viên kịp di chuyển giữa các phòng học."
  },
  {
    input: "T3(13:00-15:00), T3(12:00-14:00)",
    expectedValid: false,
    expectedError: "Lịch học vào Thứ 3 (13:00-15:00 và 12:00-14:00) phải cách nhau ít nhất 5 phút để sinh viên kịp di chuyển giữa các phòng học."
  },
  {
    input: "T4(14:00-13:00)",
    expectedValid: false,
    expectedError: "Giờ bắt đầu (14:00) phải nhỏ hơn giờ kết thúc (13:00)."
  },
  {
    input: "T5(08:00-10:00), T5(08:00-10:00)",
    expectedValid: false
  },
  {
    input: "",
    expectedValid: true
  },
  {
    input: "T2(08:30-11:00), T2(07:30-10:00)",
    expectedValid: false
  }
];

let failed = false;
testCases.forEach((tc, idx) => {
  const result = validateSchedule(tc.input);
  if (result.valid !== tc.expectedValid) {
    console.error(`FAIL: Test Case ${idx + 1} ("${tc.input}"): expected valid = ${tc.expectedValid}, got ${result.valid}`);
    failed = true;
  } else if (!result.valid && tc.expectedError && result.error !== tc.expectedError) {
    console.error(`FAIL: Test Case ${idx + 1} ("${tc.input}"): expected error = "${tc.expectedError}", got "${result.error}"`);
    failed = true;
  } else {
    console.log(`PASS: Test Case ${idx + 1} ("${tc.input}")`);
  }
});

if (failed) {
  process.exit(1);
} else {
  console.log("All schedule validation tests passed successfully!");
}
