export interface IUser {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IAUthUser extends Pick <IUser, 'id' | 'email'> {
    roles: string[];
}