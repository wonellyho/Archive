export interface Profile {
  name: string;
  tagline: string;
  bio: string;
  keywords: string[];
  profileImageUrl?: string;
  /** 공개 페이지 주소(/u/{username})용. 영문 소문자·숫자·_·- 3~30자. 없을 수 있음. */
  username?: string;
}
