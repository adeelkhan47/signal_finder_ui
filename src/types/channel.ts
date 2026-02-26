export interface Channel {
  id: number;
  order?: string;
  name: string;
  nick_name: string;
  folder: string;
  latitude: string;
  longitude: string;
  status: boolean;
  show?: boolean;
}

export interface ChannelCreate {
  order?: string;
  name: string;
  nick_name: string;
  folder?: string;
  latitude: string;
  longitude: string;
  status: boolean;
}
