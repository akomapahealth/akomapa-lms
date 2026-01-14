import Image from "next/image";

export const Logo = () => {
    return (
        <div className="flex items-center gap-x-2">
            <Image 
                height={50}
                width={130}
                alt="Akomapa LMS"
                src="/akomapa-logo.png"
                className="object-contain"
            />
        </div>
    )
}