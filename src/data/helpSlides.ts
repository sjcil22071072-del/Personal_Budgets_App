export interface HelpSlide {
  title: string
  body: string
  icon: string
}

export interface HelpSection {
  key: string
  title: string
  slides: HelpSlide[]
}

export const HELP_SECTIONS: Record<string, HelpSection> = {
  home: {
    key: 'home',
    title: '메인 화면 안내',
    slides: [
      {
        icon: '💰',
        title: '내 예산 현황',
        body: '화면 위쪽에서 이번 달 남은 돈을 확인할 수 있어요. 숫자가 클수록 아직 사용할 수 있는 돈이 많이 남아 있어요.',
      },
      {
        icon: '🕐',
        title: '최근 사용 내역',
        body: '내가 최근에 어디에 돈을 썼는지 바로 볼 수 있어요. 항목을 누르면 자세한 내용도 확인할 수 있어요.',
      },

      {
        icon: '⚙️',
        title: '화면 구성 편집',
        body: '오른쪽 위 설정 버튼을 누르면 글자 크기나 화면 색을 설정할 수 있어요.',
      },
    ],
  },
  calendar: {
    key: 'calendar',
    title: '달력 안내',
    slides: [
      {
        icon: '📅',
        title: '달력으로 한눈에 보기',
        body: '달력에서 내가 돈을 쓴 날에 표시가 나타나요. 날짜를 누르면 그날의 사용 내역을 볼 수 있어요.',
      },
      {
        icon: '🔵',
        title: '표시 색깔 의미',
        body: '초록색은 확정된 거래, 주황색은 아직 확인 중인 거래예요. 선생님이 확인하면 초록색으로 바뀌어요.',
      },
      {
        icon: '◀▶',
        title: '다른 달 보기',
        body: '달력 위쪽 화살표(◀▶)를 누르면 지난달이나 다음 달로 이동할 수 있어요.',
      },
    ],
  },
  receipt: {
    key: 'receipt',
    title: '영수증 안내',
    slides: [
      {
        icon: '📸',
        title: '영수증 사진 찍기',
        body: '"영수증 올리기" 버튼을 누르면 카메라로 사진을 찍거나 저장된 사진을 올릴 수 있어요.',
      },
      {
        icon: '✍️',
        title: '내용 입력하기',
        body: '영수증을 올린 후 어디서 무엇을 샀는지, 얼마를 썼는지 입력해요.',
      },
      {
        icon: '📤',
        title: '제출하기',
        body: '"제출" 버튼을 누르면 선생님께 영수증이 전달돼요. 선생님이 확인하면 나의 거래 내역에 기록돼요.',
      },
      {
        icon: '⏳',
        title: '확인 대기 중',
        body: '제출한 영수증은 선생님이 확인하기 전까지 "대기 중" 상태예요. 확인되면 알림이 와요.',
      },
    ],
  },
  more: {
    key: 'more',
    title: '더보기 안내',
    slides: [
      {
        icon: '🖼️',
        title: '사진 모아보기',
        body: '활동하면서 찍은 사진들을 달별로 모아서 볼 수 있어요. 즐거웠던 순간들을 다시 볼 수 있어요!',
      },
      {
        icon: '⚙️',
        title: '설정 및 로그아웃',
        body: '내 정보를 바꾸거나 앱을 잠시 나가고 싶을 때는 "로그아웃" 버튼을 누르면 돼요.',
      },
    ],
  },
}
