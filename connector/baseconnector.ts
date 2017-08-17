export interface baseconnector {
    Connect(user, password: string): Promise<Boolean>
    Watch(url: string, index: number, time: number, senderFunc: any): Promise<string>
    Stop(): void
    Alive(): void
    IsAlive(): boolean
    Topic(): string
    Forum(): string
}