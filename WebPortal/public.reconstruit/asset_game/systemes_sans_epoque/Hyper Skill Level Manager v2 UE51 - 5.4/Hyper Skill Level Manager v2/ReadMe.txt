||Introduction ||
Hello there!
It is nice to meet you. My name is Eric, the creator of this asset. Thank you for making the awesome choice to purchase this asset. It is much appreciated. With that support, I am able to continue helping other game developers. 
Always feel free to reach out. For instance, via mail or join the conversation with hundreds of other game developers in our gaming community here: https://discord.gg/hNe9bha4D6  

|| Documentation, Support, and Community ||
Initial Support like bug encounters and online documentation are available after purchase verification. You can do so by mail or via Discord. The latter has an automated bot that works via a command to verify. 
The discord is a meeting place where other game developers that are in the same boat as you can discuss, showcase, and also help each other out. That also includes me, the developer[Eric].
Unfortunately, due to many illegal resellers of my assets, I am forced to ask for your verification. Hyper is not a massive corporation with a lot of profits, so it affects me a lot.

|| Modular approach||
I am to provide multiple types of game templates over time. For instance Survival, RPG, Shooter, or RTS templates. I will grow over time and release those when they are ready.
Those templates will exist out of modular components which you can choose to purchase individually instead of the full template. Or if the full template is not available yet, combine the modular components yourself as you see fit.
You can find all my assets here: https://www.unrealengine.com/marketplace/en-US/profile/Games+By+Hyper

|| V1 vs V2 versions||
Please note the “V1” and “V2” labels on my assets. The v1 versions are my original versions and are based on UE4. If you are using UE5, I would always advise you to use the V2 version. The V2 versions are significantly changed architecturally and visually and are different products, however with the same goal. All original products will stay as is and if needed I supply bug fixes for them.

||FAQ||
Q:What is up with the folder structure in the V2 versions?
A: If you are looking at a V2 version, you will see a Hyper folder and a lot of sub-folders in it which do not seem to be related to the product itself.
I’ve been trying to make all my V2 products as complete as possible. As an example:
In the tree-cutting system, some would want to know how to pick up a log, connect it to a combat component to apply damage to the tree, make the hatchet swappable, and put a log in an inventory. 

To show you how, I have included all of these examples by connecting them to a basic version of the inventory, equipment, interaction, and combat component.

Don’t worry, if you do not want to use my other modular assets, it is no problem. You can remove it after clearing the dependencies and use the example integrations as an example of how to integrate into your own.

Q: But what about the unrelated folders?
A: Sometimes you will also have folders like “Farming system, Footstep System, etc even though it does not seem linked. They are here for an optimal migration experience in the case you do want to migrate them together. If not, always feel free to remove it after clearing the dependencies.

Some common use cases of folders that seem unrelated:
- Attribute Manager > Because the equipment attributes are managed in the attribute manager. It is overriding it by just applying damage. However, for optimal migration, you will want the reference to the abstract.
- Footstep System > Because the Notify for the footsteps is in the animations used by the character. It does not do anything, but it is there for optimal migration if you do migrate the footstep system.
- Outliner > Because when you migrate the outliner on this project it will work directly, the reference is in the interaction system.
- Building System > Because if you want to migrate the building system in it, the building functionality for "place" is in the inventory. So a reference to the building abstract is present
- Farming System > Because it is linked in the equipment manager for special action: "Fertilizer, Add water and Cure Plan"
- Level Manager > If picking up an item in the inventory, it is checking to add XP.
- Swimming System > Because in the animation blueprint that is shared by all, I’ve set up the integrations with the swimming system
- Character Voice System > Because it is triggering a notify for in animations for when you want to play a jump grunt or something like that. It is not playing it. But if migrating the voice system over it, it will automatically work.

Q: Am I required to use your other assets?
A: Absolutely not. I am trying to provide the best building blocks for any of your projects. Feel free to adapt them as you see fit. I’ve made it as easy as possible to work on any type of project.

Q: How long have you been working on this? 
A: Good question. The answer is actually years! I do have over 10 years of experience now in Unreal Engine. Only in the past years, I have been working on these assets. So yes that will mean if you have purchased my assets, you are using years of work to your advantage! I hope this helps you enable to focus on the creative side of the project.

Q: Did you make everything yourself?
A: Nearly everything is made by myself! However, I am also using amazing Epic Games content where I can. For instance, for my advanced locomotion framework I've took the Lyra animations a base and adapted it.
I also would like to reference some cool asset creators that publish CC0 models which I occasingly use. Please support them where possible: 
https://polyhaven.com/
https://ambientcg.com/
https://www.3dmodelscc0.com/
https://opengameart.org/
https://www.blendswap.com/ (Please make sure to filter on CC0)

Q: I see emtpy functions in an "Abstract" class. What is up with that?
A: Abstract Classes declare functions that are being used in child classes. 
The abstract aims to include the minimum that should be ably exposed so other external classes can interact with it. 
The abstract also declares variables that are used in all other modules.
By means of structural inheritance, we are able to swap child components of this abstract on any actor without messing up the references.
If you swap one of the child components for another child component, calling functions will stay the same due to the structural inheritance of the abstract. You will keep calling the functions externally on the abstract. Due to dynamic dispatching, it will determine on which child it will execute the actual logic. That would be the one that you have assigned: e.g. the advanced or basic component.
By using this method, I am making sure to couple the components as loosely as I am able to. This will benefit nearly all potential non-functional requirements of your project (ISO25010) like modularity, compatibility, useability, maintainability, and portability.

In most of my systems, I have made two children of the abstract: Advanced and Basic
Basic:
The basic version is not intended to be game-ready. It is intended to show how other systems are able to interact with each other and give you guidance on how to do so.
As an example: 
In the tree-cutting system, some would want to know how to pick up a log, connect it to a combat component to apply damage to the tree, make the hatchet swappable, and put a log in an inventory. 

To show you how, I have included all of these examples by connecting them to a basic version of the inventory, equipment, interaction, and combat component.
The ”Basic” component is swappable with the “advanced” component of my other modular systems and it will nearly always work well. Sometimes you will need to change settings and code which I purged for the sake of folder clutter.
If you do not want to use my other modular assets, it is no problem. You can remove it and use the basic integrations as an example of how to integrate into your own.

Advanced:
The advanced can be a child of the basic or a direct child of the abstract. That depends on if the functionality of the basic will exactly be the same in the advanced. It does implement extra functions besides the basic component. It can optionally override an existing function of the basic to give a certain addition to the basic function.
The advanced components are intended to be preferably used above the basic components and should be able to swap easily.


||Roadmap||
Are you curious about what I am working on? See the complete roadmap here: https://trello.com/b/QU8FTpHV/hyperreuts-marketplace-roadmap

||Empower Hyper||
With your help, Hyper is able to offer you to keep building the best virtual worlds. Empower us so we can empower you!

Did you not obtain this copy from the unreal marketplace? Please know that it hurts me a lot. I am a sole developer which wants to empower world builders like you. I can only keep doing this if you also support me. Thank you for your consideration!

Patreon:
 Unlock Golden, Epic or Legendary badges and other cool features and services by supporting Hyper on Patreon. 
https://www.patreon.com/GamesByHyper 

Buy us a coffee or contribute to a specific task:
https://www.paypal.com/donate/?hosted_button_id=3LVU5EQZZ7L54

Merch:
Did you know we also have awesome merchandise? Order it now!
https://hyper-66.creator-spring.com

I hope to see you in our community!

With warm regards,

Eric 
